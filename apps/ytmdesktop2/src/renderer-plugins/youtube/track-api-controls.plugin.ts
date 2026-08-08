import definePlugin from "@plugins/utils";
import type { PlayerApi } from "ytm-client-api";

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

type YtmStoreLike = {
	getState: () => { queue?: { items?: unknown[]; nextQueueItemId?: number; shuffleEnabled?: boolean } };
	dispatch: (action: unknown) => void;
};

function resolveYtmStore(): YtmStoreLike | null {
	const fromHook = (window as unknown as { __YTMD_HOOK__?: { ytmStore?: YtmStoreLike } }).__YTMD_HOOK__?.ytmStore;
	if (fromHook?.getState && fromHook?.dispatch) return fromHook;
	const selectors = ["ytmusic-app", "ytmusic-app-layout>ytmusic-player-bar", "ytmusic-player-bar"] as const;
	for (const selector of selectors) {
		const store = (document.querySelector(selector) as { store?: YtmStoreLike } | null)?.store;
		if (store?.getState && store?.dispatch) {
			if (!(window as unknown as { __YTMD_HOOK__?: unknown }).__YTMD_HOOK__) {
				(window as unknown as { __YTMD_HOOK__: { ytmStore: YtmStoreLike } }).__YTMD_HOOK__ = { ytmStore: store };
			}
			return store;
		}
	}
	return null;
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

function readLikeStatus(): { liked: boolean; disliked: boolean } {
	const el = document.querySelector<HTMLElement>("#like-button-renderer, ytmusic-like-button-renderer");
	const status = (el?.getAttribute("like-status") || el?.getAttribute("like_status") || "").toUpperCase();
	if (status === "LIKE" || status === "DISLIKE" || status === "INDIFFERENT") {
		return { liked: status === "LIKE", disliked: status === "DISLIKE" };
	}
	const likePressed = document.querySelector<HTMLElement>("#like-button-renderer #button-shape-like.like button")?.getAttribute("aria-pressed") === "true";
	const dislikePressed =
		document.querySelector<HTMLElement>("#like-button-renderer #button-shape-dislike.dislike button")?.getAttribute("aria-pressed") === "true";
	return { liked: likePressed, disliked: dislikePressed };
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
	 * Add to YTM queue (upstream companion `queueAdd` / queueadd.script.js).
	 * Uses `yt-service-request` → `queueAddEndpoint`, then store `ADD_ITEMS` when available.
	 *
	 * Upstream rule: pass **either** `videoId` **or** `playlistId`, never both
	 * (both → API 400 `browse_id` / INVALID_ARGUMENT).
	 */
	queueAdd: async (data?: { videoId?: string; playlistId?: string; index?: number }) => {
		const videoId = data?.videoId?.trim() || undefined;
		const playlistIdOnly = data?.playlistId?.trim() || undefined;
		// Upstream companion: XOR — both → YTM 400 browse_id INVALID_ARGUMENT.
		const videoIdFinal = videoId;
		const playlistId = videoIdFinal ? undefined : playlistIdOnly;
		if (!videoIdFinal && !playlistId) throw new Error("videoId or playlistId required");

		const bar = document.querySelector("ytmusic-app-layout>ytmusic-player-bar") as HTMLElement | null;
		if (!bar) throw new Error("player bar not found");

		const store = resolveYtmStore();
		const index =
			typeof data?.index === "number" && Number.isFinite(data.index)
				? data.index
				: (store?.getState?.()?.queue?.items?.length ?? 0);

		const queueTarget = videoIdFinal ? { videoId: videoIdFinal } : { playlistId: playlistId! };

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
									queueTarget,
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
					const items = response?.data?.queueDatas?.map((d: any) => d.content);
					const liveStore = resolveYtmStore() ?? store;
					if (liveStore && Array.isArray(items) && items.length) {
						const queue = liveStore.getState()?.queue;
						liveStore.dispatch({
							type: "ADD_ITEMS",
							payload: {
								nextQueueItemId: queue?.nextQueueItemId,
								index,
								items,
								shuffleEnabled: queue?.shuffleEnabled,
								shouldAssignIds: true,
							},
						});
					}
					resolve();
				},
				(err: unknown) => reject(err instanceof Error ? err : new Error("queueAdd request failed")),
			);
		});

		return {
			ok: true as const,
			videoId: videoIdFinal ?? null,
			playlistId: playlistId ?? null,
			index,
			storeHooked: !!resolveYtmStore(),
		};
	},
	queueList: async () => {
		const store = resolveYtmStore();
		const rawItems = store?.getState?.()?.queue?.items ?? [];
		const items = rawItems.map((item, index) => summarizeQueueItem(item, index));
		return { items, count: items.length, storeHooked: !!store };
	},
	queueClear: async (playerApi: PlayerApi) => {
		if (typeof playerApi.clearQueue === "function") {
			playerApi.clearQueue();
		} else {
			throw new Error("clearQueue not available");
		}
		return { ok: true as const };
	},
};

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
