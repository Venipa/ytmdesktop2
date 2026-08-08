import definePlugin from "@plugins/utils";
import type { PlayerApi } from "ytm-client-api";
import { readLikeStatus } from "./ytm-like-status";
import {
	dispatchQueueAddItems,
	resolveYtmApp,
	resolveYtmStore,
	type YtmStoreLike,
} from "./ytm-store";

type SeekPayload = { time?: number; type?: "seek" };

type NavigatePayload = {
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
	document.dispatchEvent(
		new CustomEvent("yt-navigate", {
			bubbles: true,
			cancelable: true,
			composed: true,
			detail: { endpoint },
		}),
	);
	const app = document.querySelector("ytmusic-app") as { navigate?: (endpoint: Record<string, unknown>) => void } | null;
	if (typeof app?.navigate === "function") {
		try {
			app.navigate(endpoint);
		} catch {
			/* yt-navigate already fired */
		}
	}
}

function buildNavigateEndpoint(data?: NavigatePayload): Record<string, unknown> {
	const videoId = data?.videoId?.trim();
	const playlistId = data?.playlistId?.trim();
	const channelId = data?.channelId?.trim();
	const handleRaw = data?.handle?.trim();
	const handle = handleRaw ? (handleRaw.startsWith("@") ? handleRaw.slice(1) : handleRaw) : "";
	const browseId = data?.browseId?.trim();

	if (videoId) {
		const watchEndpoint: { videoId: string; playlistId?: string } = { videoId };
		if (playlistId) watchEndpoint.playlistId = playlistId;
		return { watchEndpoint };
	}

	if (playlistId && data?.play) {
		return { watchEndpoint: { playlistId } };
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
		// Handles often lack browseId — urlEndpoint is the reliable in-app path (still via yt-navigate).
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

const trackControls = {
	toggle: (player: PlayerApi) => {
		const state = player.getPlayerStateObject();
		if (!state) throw new Error("Player state not found");
		state.isPlaying ? player.pauseVideo() : player.playVideo();
		return playbackSnapshot(player, !state.isPlaying);
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
		const btn = document.querySelector<HTMLElement>("#like-button-renderer #button-shape-like.like button");
		const current = readLikeStatus();
		if (!btn) return current.liked;
		if (current.liked === liked) return liked;
		btn.click();
		for (let i = 0; i < 12; i++) {
			await new Promise((r) => setTimeout(r, 40));
			if (readLikeStatus().liked === liked) return liked;
		}
		return liked;
	},
	dislike: async (disliked: boolean) => {
		const btn = document.querySelector<HTMLElement>("#like-button-renderer #button-shape-dislike.dislike button");
		const current = readLikeStatus();
		if (!btn) return current.disliked;
		if (current.disliked === disliked) return disliked;
		btn.click();
		for (let i = 0; i < 12; i++) {
			await new Promise((r) => setTimeout(r, 40));
			if (readLikeStatus().disliked === disliked) return disliked;
		}
		return disliked;
	},
	likeState: () => readLikeStatus(),
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
		throw new Error("queueAdd failed — play a track first (queue context missing)");
	}

	const result = await fetch("/music/get_queue", {
		queueContextParams,
		queueInsertPosition: "INSERT_AT_END",
		videoIds: [videoId],
	});
	const items = result?.queueDatas?.map((d) => d.content).filter(Boolean) ?? [];
	if (!items.length) throw new Error("queueAdd failed — get_queue returned no items");
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

export default definePlugin(
	"track-api-controls",
	{
		enabled: true,
		displayName: "Track API Controls",
		service: "api",
	},
	{
		cmds: {
			toggle: async ({ playerApi }) => trackControls.toggle(playerApi),
			play: async ({ playerApi }) => trackControls.play(playerApi),
			pause: async ({ playerApi }) => trackControls.pause(playerApi),
			next: async ({ playerApi }) => trackControls.next(playerApi),
			prev: async ({ playerApi }) => trackControls.prev(playerApi),
			isPlaying: async ({ playerApi }) => trackControls.isPlaying(playerApi),
			repeat: async ({ playerApi }) => trackControls.repeat(playerApi),
			shuffle: async ({ playerApi }) => trackControls.shuffle(playerApi),
			forward: async ({ playerApi }, data?: SeekPayload) => trackControls.forward(playerApi, data),
			backward: async ({ playerApi }, data?: SeekPayload) => trackControls.backward(playerApi, data),
			seek: async ({ playerApi }, data?: SeekPayload) => trackControls.seek(playerApi, data),
			like: async (_ctx, liked: boolean) => trackControls.like(liked),
			dislike: async (_ctx, disliked: boolean) => trackControls.dislike(disliked),
			likeState: async () => trackControls.likeState(),
			volume: async ({ playerApi }, data?: { volume?: number }) => trackControls.volume(playerApi, data),
			volumeUp: async ({ playerApi }, data?: { amount?: number }) => trackControls.volumeUp(playerApi, data),
			volumeDown: async ({ playerApi }, data?: { amount?: number }) => trackControls.volumeDown(playerApi, data),
			navigate: async (_ctx, data?: NavigatePayload) => trackControls.navigate(data),
			queueAdd: async (_ctx, data?: { videoId?: string; playlistId?: string; index?: number }) => trackControls.queueAdd(data),
			queueList: async (_ctx) => trackControls.queueList(),
			queueClear: async ({ playerApi }) => trackControls.queueClear(playerApi),
		},
	},
);
