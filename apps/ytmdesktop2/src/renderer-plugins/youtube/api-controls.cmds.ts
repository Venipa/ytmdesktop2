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
	repeat: (playerApi: PlayerApi) => {
		const next = !playerApi.getLoopVideo?.();
		playerApi.setLoopVideo?.(next);
		return { loop: next, ...playbackSnapshot(playerApi) };
	},
	shuffle: (_playerApi: PlayerApi) => {
		const btn = document.querySelector<HTMLElement>("ytmusic-player-bar #button-shape-shuffle button, ytmusic-player-bar [aria-label*='Shuffle' i]");
		btn?.click();
		return { ok: !!btn };
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
		const store = resolveYtmStore();
		const rawItems = store?.getState?.()?.queue?.items ?? [];
		const items = rawItems.map((item, index) => summarizeQueueItem(item, index));
		return { items, count: items.length, storeHooked: !!store };
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
	const fetch = resolveYtmApp()?.networkManager?.fetch;
	if (!liveStore || !queueContextParams || typeof fetch !== "function") {
		throw new Error("queueAdd failed - play a track first (queue context missing)");
	}

	const result = await fetch("/music/get_queue", {
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

function summarizeQueueItem(item: unknown, index: number): { index: number; videoId?: string; title?: string } {
	const root = item as Record<string, any> | null;
	const renderer =
		root?.playlistPanelVideoRenderer ??
		root?.playlistPanelVideoWrapperRenderer?.counterpart?.[0]?.counterpartRenderer?.playlistPanelVideoRenderer ??
		root;
	const videoId =
		(typeof renderer?.videoId === "string" && renderer.videoId) ||
		renderer?.navigationEndpoint?.watchEndpoint?.videoId ||
		undefined;
	const title =
		renderer?.title?.runs?.[0]?.text ||
		renderer?.title?.simpleText ||
		renderer?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text ||
		undefined;
	return {
		index,
		...(videoId ? { videoId: String(videoId) } : {}),
		...(title ? { title: String(title) } : {}),
	};
}
