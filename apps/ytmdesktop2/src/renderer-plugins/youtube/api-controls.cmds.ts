import type { PlayerApi } from "ytm-client-api";
import { readActiveVideoId, readLikeStatus, type YtmLikeStatus } from "./ytm-like-status";
import {
	dispatchQueueAddItems,
	resolveYtmApp,
	resolveYtmStore,
	type YtmStoreLike,
} from "./ytm-store";

export type SeekPayload = { time?: number; type?: "seek" };

export type NavigatePayload = {
	videoId?: string;
	playlistId?: string;
	play?: boolean;
	channelId?: string;
	handle?: string;
	browseId?: string;
};

function playlistBrowseId(playlistId: string): string {
	const id = playlistId.trim();
	if (!id) return id;
	if (/^(VL|OLAK|RD|MP)/i.test(id)) return id;
	return `VL${id}`;
}

function dispatchYtNavigate(endpoint: Record<string, unknown>): void {
	// Upstream (ytmdesktop) only fires this event - do not also call ytmusic-app.navigate().
	// Dual dispatch starts playback but clears main content (empty page behind player).
	document.dispatchEvent(
		new CustomEvent("yt-navigate", {
			detail: { endpoint },
		}),
	);
}

function buildNavigateEndpoint(data?: NavigatePayload): Record<string, unknown> {
	const videoId = data?.videoId?.trim();
	const playlistId = data?.playlistId?.trim();
	const channelId = data?.channelId?.trim();
	const handleRaw = data?.handle?.trim();
	const handle = handleRaw ? (handleRaw.startsWith("@") ? handleRaw.slice(1) : handleRaw) : "";
	const browseId = data?.browseId?.trim();

	if (videoId) {
		const watchEndpoint: Record<string, unknown> = {
			videoId,
			watchEndpointMusicSupportedConfigs: {
				watchEndpointMusicConfig: {
					musicVideoType: "MUSIC_VIDEO_TYPE_ATV",
				},
			},
		};
		if (playlistId) watchEndpoint.playlistId = playlistId;
		return { watchEndpoint };
	}

	if (playlistId && data?.play) {
		return {
			watchEndpoint: {
				playlistId,
				watchEndpointMusicSupportedConfigs: {
					watchEndpointMusicConfig: {
						musicVideoType: "MUSIC_VIDEO_TYPE_ATV",
					},
				},
			},
		};
	}

	if (playlistId) {
		return { browseEndpoint: { browseId: playlistBrowseId(playlistId) } };
	}

	if (channelId) {
		return {
			browseEndpoint: {
				browseId: channelId,
				canonicalBaseUrl: `/channel/${channelId}`,
			},
		};
	}

	if (handle) {
		// Handles often lack browseId - urlEndpoint is the reliable in-app path (still via yt-navigate).
		return { urlEndpoint: { url: `https://music.youtube.com/@${encodeURIComponent(handle)}` } };
	}

	if (browseId) {
		return { browseEndpoint: { browseId } };
	}

	throw new Error("navigate requires videoId, playlistId, channelId, handle, or browseId");
}

function isPlayingState(playerApi: PlayerApi): boolean {
	return playerApi.getPlayerState() === 1;
}

type YtmPlayerBar = HTMLElement & {
	queue?: { shuffle?: () => void };
	onRepeatButtonClick?: () => void;
	repeatMode?: string;
};

function queryPlayerBar(): YtmPlayerBar | null {
	return document.querySelector("ytmusic-player-bar");
}

function isShuffleOn(bar: YtmPlayerBar | null, store: YtmStoreLike | null): boolean {
	if (bar?.hasAttribute("shuffle-on")) return true;
	return !!store?.getState()?.queue?.shuffleEnabled;
}

function isRepeatOn(bar: YtmPlayerBar | null, playerApi: PlayerApi): boolean {
	const mode = String(bar?.getAttribute("repeat-mode") ?? bar?.repeatMode ?? "").toUpperCase();
	if (mode && mode !== "NONE") return true;
	return !!playerApi.getLoopVideo?.();
}

function applyRepeatEnabled(bar: YtmPlayerBar | null, playerApi: PlayerApi, on: boolean) {
	if (typeof bar?.onRepeatButtonClick === "function") {
		for (let i = 0; i < 3 && isRepeatOn(bar, playerApi) !== on; i++) bar.onRepeatButtonClick();
		return;
	}
	playerApi.setLoop?.(on);
	playerApi.setLoopVideo?.(on);
}

function playbackSnapshot(playerApi: PlayerApi, playing?: boolean) {
	return {
		isPlaying: playing ?? isPlayingState(playerApi),
		time: playerApi.getCurrentTime(),
	};
}

async function waitLike(videoId: string | null, pred: (s: YtmLikeStatus) => boolean, fallback: boolean): Promise<boolean> {
	for (let i = 0; i < 12; i++) {
		await new Promise((r) => setTimeout(r, 40));
		const status = readLikeStatus(videoId);
		if (status.settled && pred(status)) return fallback;
	}
	return fallback;
}

export const trackControls = {
	toggle: (player: PlayerApi) => {
		const playing = isPlayingState(player);
		playing ? player.pauseVideo() : player.playVideo();
		return playbackSnapshot(player, !playing);
	},
	play: (playerApi: PlayerApi) => {
		playerApi.playVideo();
		return playbackSnapshot(playerApi, true);
	},
	pause: (playerApi: PlayerApi) => {
		playerApi.pauseVideo();
		return playbackSnapshot(playerApi, false);
	},
	next: (playerApi: PlayerApi) => {
		playerApi.nextVideo();
		return playbackSnapshot(playerApi);
	},
	prev: (playerApi: PlayerApi) => {
		playerApi.previousVideo();
		return playbackSnapshot(playerApi);
	},
	isPlaying: (player: PlayerApi) => {
		const state = player.getPlayerStateObject();
		if (!state) return false;
		return !!state.isPlaying;
	},
	repeat: (playerApi: PlayerApi, loop?: boolean) => {
		const bar = queryPlayerBar();
		if (typeof loop === "boolean") {
			applyRepeatEnabled(bar, playerApi, loop);
		} else if (typeof bar?.onRepeatButtonClick === "function") {
			bar.onRepeatButtonClick();
		} else {
			applyRepeatEnabled(bar, playerApi, !isRepeatOn(bar, playerApi));
		}
		const on = isRepeatOn(bar, playerApi);
		return { loop: on, ...playbackSnapshot(playerApi) };
	},
	shuffle: (playerApi: PlayerApi) => {
		const bar = queryPlayerBar();
		const store = resolveYtmStore();
		const wasOn = isShuffleOn(bar, store);
		if (typeof bar?.queue?.shuffle === "function") {
			bar.queue.shuffle();
		} else if (store) {
			store.dispatch({ type: "SET_SHUFFLE", payload: !wasOn });
		} else {
			playerApi.setShuffle?.(!wasOn);
		}
		const on = isShuffleOn(bar, resolveYtmStore());
		return { shuffle: on, ...playbackSnapshot(playerApi) };
	},
	/** `time` is milliseconds. `type: "seek"` = absolute; otherwise relative (`seekBy`). */
	seek: (playerApi: PlayerApi, data?: SeekPayload) => {
		const timeMs = Number(data?.time ?? 0);
		const timeSec = timeMs / 1000;
		if (data?.type === "seek") playerApi.seekTo(timeSec);
		else playerApi.seekBy(timeSec);
		return playbackSnapshot(playerApi);
	},
	forward: (playerApi: PlayerApi, data?: SeekPayload) => trackControls.seek(playerApi, { time: Math.abs(Number(data?.time ?? 10000)) }),
	backward: (playerApi: PlayerApi, data?: SeekPayload) => trackControls.seek(playerApi, { time: -Math.abs(Number(data?.time ?? 10000)) }),
	like: async (liked: boolean) => {
		const videoId = readActiveVideoId();
		const btn = document.querySelector<HTMLElement>("ytmusic-player-bar #button-shape-like.like button");
		const current = readLikeStatus(videoId);
		if (!btn) return current.liked;
		if (current.liked === liked) return liked;
		btn.click();
		return waitLike(videoId, (s) => s.liked === liked, liked);
	},
	dislike: async (disliked: boolean) => {
		const videoId = readActiveVideoId();
		const btn = document.querySelector<HTMLElement>("ytmusic-player-bar #button-shape-dislike.dislike button");
		const current = readLikeStatus(videoId);
		if (!btn) return current.disliked;
		if (current.disliked === disliked) return disliked;
		btn.click();
		return waitLike(videoId, (s) => s.disliked === disliked, disliked);
	},
	volume: (playerApi: PlayerApi, data?: { volume?: number }) => {
		if (typeof data?.volume === "number" && Number.isFinite(data.volume)) {
			playerApi.setVolume(Math.max(0, Math.min(100, data.volume)));
		}
		return { volume: playerApi.getVolume() };
	},
	volumeUp: (playerApi: PlayerApi, data?: { amount?: number }) => {
		const amount = typeof data?.amount === "number" && Number.isFinite(data.amount) ? data.amount : 5;
		const next = Math.min(100, Number(playerApi.getVolume() ?? 0) + Math.abs(amount));
		playerApi.setVolume(next);
		return { volume: playerApi.getVolume() };
	},
	volumeDown: (playerApi: PlayerApi, data?: { amount?: number }) => {
		const amount = typeof data?.amount === "number" && Number.isFinite(data.amount) ? data.amount : 5;
		const next = Math.max(0, Number(playerApi.getVolume() ?? 0) - Math.abs(amount));
		playerApi.setVolume(next);
		return { volume: playerApi.getVolume() };
	},
	/**
	 * In-page YTM navigation via `yt-navigate`.
	 * - watch: videoId (+ optional playlistId)
	 * - play playlist: playlistId + play
	 * - browse playlist: playlistId
	 * - channel: channelId and/or handle (@…)
	 */
	navigate: (data?: {
		videoId?: string;
		playlistId?: string;
		play?: boolean;
		channelId?: string;
		handle?: string;
		browseId?: string;
	}) => {
		const endpoint = buildNavigateEndpoint(data);
		dispatchYtNavigate(endpoint);
		return { ok: true as const, endpoint };
	},
	/**
	 * Add to YTM queue. Video → `/music/get_queue` + `ADD_ITEMS`.
	 * Playlist-only → service endpoint (video XOR playlist).
	 */
	queueAdd: async (data?: { videoId?: string; playlistId?: string; index?: number }) => {
		const videoId = data?.videoId?.trim() || undefined;
		const playlistId = videoId ? undefined : data?.playlistId?.trim() || undefined;
		if (!videoId && !playlistId) throw new Error("videoId or playlistId required");

		const store = resolveYtmStore();
		const index =
			typeof data?.index === "number" && Number.isFinite(data.index)
				? data.index
				: (store?.getState?.()?.queue?.items?.length ?? 0);

		if (videoId) {
			await queueAddVideo(videoId, index, store);
			return { ok: true as const, videoId, playlistId: null, index, storeHooked: !!store };
		}

		await queueAddPlaylist(playlistId!, index, store);
		return { ok: true as const, videoId: null, playlistId, index, storeHooked: !!store };
	},
	queueList: async () => {
		const store = await waitYtmStore();
		const rawItems = store?.getState?.()?.queue?.items ?? [];
		const items = rawItems.map((item, index) => summarizeQueueItem(item, index));
		if (!store) throw new Error("queueList failed - ytm store not ready");
		return { items, count: items.length, storeHooked: true as const };
	},
	queuePlay: (playerApi: PlayerApi | null, data?: { index?: number; videoId?: string }) => {
		const store = resolveYtmStore();
		const rawItems = store?.getState?.()?.queue?.items ?? [];
		let index =
			typeof data?.index === "number" && Number.isFinite(data.index) ? Math.floor(data.index) : -1;
		const wantId = data?.videoId?.trim();
		if (wantId) {
			const found = rawItems.findIndex((item, i) => queueItemHitsId(summarizeQueueItem(item, i), wantId));
			if (found >= 0) index = found;
		}
		if (index < 0) throw new Error("queuePlay failed - index required");
		const item = rawItems[index];
		const endpoint = queueItemEndpoint(item);
		if (endpoint) {
			dispatchYtNavigate(endpoint);
			return { ok: true as const, index };
		}
		store?.dispatch?.({ type: "SET_INDEX", payload: index });
		const row = document.querySelectorAll("ytmusic-player-queue-item")[index] as HTMLElement | undefined;
		const hit = row?.querySelector<HTMLElement>("a, button, [role='button']") ?? row;
		if (hit) {
			hit.click();
			return { ok: true as const, index };
		}
		if (typeof playerApi?.playVideoAt === "function") playerApi.playVideoAt(index);
		return { ok: true as const, index };
	},
	queueClear: async (playerApi: PlayerApi) => {
		const store = resolveYtmStore();
		if (store?.dispatch) {
			store.dispatch({ type: "CLEAR" });
			return { ok: true as const };
		}
		if (typeof playerApi.clearQueue === "function") {
			playerApi.clearQueue();
			return { ok: true as const };
		}
		throw new Error("clearQueue not available");
	},
};

/** Video queue via Innertube get_queue (queueAddEndpoint 400s on current YTM). */
async function queueAddVideo(videoId: string, index: number, store: YtmStoreLike | null): Promise<void> {
	const liveStore = store ?? resolveYtmStore();
	const queueContextParams = liveStore?.getState?.()?.queue?.queueContextParams;
	const manager = resolveYtmApp()?.networkManager;
	if (!liveStore || !queueContextParams || typeof manager?.fetch !== "function") {
		throw new Error("queueAdd failed - play a track first (queue context missing)");
	}

	const result = await manager.fetch("/music/get_queue", {
		queueContextParams,
		queueInsertPosition: "INSERT_AT_END",
		videoIds: [videoId],
	});
	const items = result?.queueDatas?.map((d) => d.content).filter(Boolean) ?? [];
	if (!items.length) throw new Error("queueAdd failed - get_queue returned no items");
	dispatchQueueAddItems(liveStore, items, index);
}

/** Playlist-only via yt-service-request (XOR playlistId, never with videoId). */
async function queueAddPlaylist(playlistId: string, index: number, store: YtmStoreLike | null): Promise<void> {
	const bar = document.querySelector("ytmusic-app-layout>ytmusic-player-bar") as HTMLElement | null;
	if (!bar) throw new Error("player bar not found");

	await new Promise<void>((resolve, reject) => {
		const returnValue: any[] = [];
		bar.dispatchEvent(
			new CustomEvent("yt-action", {
				bubbles: true,
				cancelable: false,
				composed: true,
				detail: {
					actionName: "yt-service-request",
					args: [
						bar,
						{
							queueAddEndpoint: {
								queueTarget: { playlistId },
								queueInsertPosition: "INSERT_AT_END",
							},
						},
					],
					optionalAction: false,
					returnValue,
				},
			}),
		);
		const ajax = returnValue[0]?.ajaxPromise;
		if (!ajax?.then) {
			reject(new Error("queueAddEndpoint not accepted"));
			return;
		}
		ajax.then(
			(response: any) => {
				const items = response?.data?.queueDatas?.map((d: any) => d.content).filter(Boolean) ?? [];
				const liveStore = resolveYtmStore() ?? store;
				if (liveStore) dispatchQueueAddItems(liveStore, items, index);
				resolve();
			},
			(err: unknown) => reject(new Error(formatYtmAjaxError(err))),
		);
	});
}

function formatYtmAjaxError(err: unknown): string {
	if (err instanceof Error && err.message) return err.message;
	if (typeof err === "string" && err.trim()) return err;
	try {
		const json = JSON.stringify(err);
		if (json && json !== "{}") return json;
	} catch {
		/* ignore */
	}
	return "queueAdd request failed";
}

export type QueueListItem = {
	index: number;
	videoId?: string;
	/** Official audio (ATV) id when it differs from `videoId`. */
	songId?: string;
	title?: string;
	artist?: string;
	thumbnail?: string;
	durationSec?: number;
};

function rendererVideoId(renderer: Record<string, any> | null | undefined): string | undefined {
	const id = renderer?.videoId || renderer?.navigationEndpoint?.watchEndpoint?.videoId;
	return typeof id === "string" && id ? id : undefined;
}

function rendererIsAtv(renderer: Record<string, any> | null | undefined): boolean {
	const type =
		renderer?.navigationEndpoint?.watchEndpoint?.watchEndpointMusicSupportedConfigs?.watchEndpointMusicConfig
			?.musicVideoType;
	return type === "MUSIC_VIDEO_TYPE_ATV";
}

function queueRenderers(item: unknown): {
	primary: Record<string, any> | null;
	counterpart: Record<string, any> | null;
} {
	const root = item as Record<string, any> | null;
	if (!root) return { primary: null, counterpart: null };
	const wrapper = root.playlistPanelVideoWrapperRenderer;
	if (wrapper) {
		return {
			primary: wrapper.primaryRenderer?.playlistPanelVideoRenderer ?? null,
			counterpart: wrapper.counterpart?.[0]?.counterpartRenderer?.playlistPanelVideoRenderer ?? null,
		};
	}
	const single =
		root.playlistPanelVideoRenderer ??
		(root.videoId || root.title || root.navigationEndpoint ? root : null);
	return { primary: single, counterpart: null };
}

function queueItemRenderer(item: unknown): Record<string, any> | null {
	const { primary, counterpart } = queueRenderers(item);
	return primary ?? counterpart;
}

function queueItemHitsId(row: QueueListItem, id: string): boolean {
	return row.videoId === id || row.songId === id;
}

function queueItemEndpoint(item: unknown): Record<string, unknown> | null {
	const renderer = queueItemRenderer(item);
	const endpoint = renderer?.navigationEndpoint;
	if (endpoint && typeof endpoint === "object") return endpoint as Record<string, unknown>;
	const videoId = rendererVideoId(renderer);
	if (!videoId) return null;
	return {
		watchEndpoint: {
			videoId: String(videoId),
			watchEndpointMusicSupportedConfigs: {
				watchEndpointMusicConfig: { musicVideoType: "MUSIC_VIDEO_TYPE_ATV" },
			},
		},
	};
}

async function waitYtmStore(timeoutMs = 2500): Promise<YtmStoreLike | null> {
	const started = Date.now();
	let store = resolveYtmStore();
	while (!store && Date.now() - started < timeoutMs) {
		await new Promise((r) => setTimeout(r, 120));
		store = resolveYtmStore();
	}
	return store;
}

function parseLengthSec(renderer: Record<string, any> | null): number | undefined {
	const text =
		(typeof renderer?.lengthText?.simpleText === "string" && renderer.lengthText.simpleText) ||
		(typeof renderer?.lengthText?.runs?.[0]?.text === "string" && renderer.lengthText.runs[0].text) ||
		"";
	const parts = text
		.trim()
		.split(":")
		.map((p: string) => Number(p));
	if (!parts.length || parts.some((n: number) => !Number.isFinite(n))) return undefined;
	let sec = 0;
	if (parts.length === 3) sec = parts[0] * 3600 + parts[1] * 60 + parts[2];
	else if (parts.length === 2) sec = parts[0] * 60 + parts[1];
	else sec = parts[0];
	return sec > 0 ? sec : undefined;
}

function lastThumbUrl(node: unknown): string | undefined {
	if (!node || typeof node !== "object") return undefined;
	const rec = node as Record<string, unknown>;
	const thumbs = rec.thumbnails;
	if (Array.isArray(thumbs) && thumbs.length) {
		const last = thumbs[thumbs.length - 1] as { url?: unknown } | undefined;
		if (typeof last?.url === "string" && last.url.trim()) return last.url.trim();
	}
	for (const key of ["thumbnail", "thumbnailRenderer", "musicThumbnailRenderer", "croppedSquareThumbnailRenderer"]) {
		const nested = lastThumbUrl(rec[key]);
		if (nested) return nested;
	}
	return undefined;
}

export function summarizeQueueItem(item: unknown, index: number): QueueListItem {
	const { primary, counterpart } = queueRenderers(item);
	const renderer = primary ?? counterpart;
	const videoId = rendererVideoId(primary) ?? rendererVideoId(counterpart);
	const counterpartId = rendererVideoId(counterpart);
	const songId = rendererIsAtv(counterpart) && counterpartId !== videoId ? counterpartId : undefined;
	const title =
		renderer?.title?.runs?.[0]?.text ||
		renderer?.title?.simpleText ||
		renderer?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text ||
		undefined;
	const artist =
		renderer?.shortBylineText?.runs?.[0]?.text ||
		renderer?.longBylineText?.runs?.[0]?.text ||
		renderer?.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text ||
		undefined;
	const thumbnail = lastThumbUrl(renderer);
	const durationSec = parseLengthSec(renderer);
	return {
		index,
		...(videoId ? { videoId: String(videoId) } : {}),
		...(songId ? { songId } : {}),
		...(title ? { title: String(title) } : {}),
		...(artist ? { artist: String(artist) } : {}),
		...(thumbnail ? { thumbnail: String(thumbnail) } : {}),
		...(durationSec != null ? { durationSec } : {}),
	};
}

/** Cheap identity for queue replace (playlist / automix swap). */
export function queueListSignature(items: unknown[], context?: string): string {
	const n = items.length;
	const first = n ? (summarizeQueueItem(items[0], 0).videoId ?? "") : "";
	const last = n ? (summarizeQueueItem(items[n - 1], n - 1).videoId ?? "") : "";
	return `${n}:${first}:${last}:${context ?? ""}`;
}
