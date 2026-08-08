import definePlugin from "@plugins/utils";
import type { PlayerApi } from "ytm-client-api";

type SeekPayload = { time?: number; type?: "seek" };

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
	 * In-page YTM navigation (same as upstream ytmdesktop `remoteControl:execute` → `navigate`).
	 * Dispatches `yt-navigate` with a watchEndpoint — no full page reload.
	 */
	navigate: (data?: { videoId?: string; playlistId?: string }) => {
		const videoId = data?.videoId?.trim();
		if (!videoId) throw new Error("videoId required");
		const watchEndpoint: { videoId: string; playlistId?: string } = { videoId };
		const playlistId = data?.playlistId?.trim();
		if (playlistId) watchEndpoint.playlistId = playlistId;
		document.dispatchEvent(
			new CustomEvent("yt-navigate", {
				detail: {
					endpoint: { watchEndpoint },
				},
			}),
		);
		return { ok: true as const, videoId, playlistId: playlistId || null };
	},
	/**
	 * Add to YTM queue (upstream companion `queueAdd` / queueadd.script.js).
	 * Uses `yt-service-request` → `queueAddEndpoint`, then store `ADD_ITEMS` when available.
	 */
	queueAdd: async (data?: { videoId?: string; playlistId?: string; index?: number }) => {
		const videoId = data?.videoId?.trim();
		if (!videoId) throw new Error("videoId required");
		const playlistId = data?.playlistId?.trim() || undefined;
		const bar = document.querySelector("ytmusic-app-layout>ytmusic-player-bar") as HTMLElement & {
			store?: { getState: () => any; dispatch: (a: unknown) => void };
		};
		if (!bar) throw new Error("player bar not found");

		const store =
			(window as any).__YTMD_HOOK__?.ytmStore ??
			bar.store ??
			(document.querySelector("ytmusic-app") as { store?: typeof bar.store } | null)?.store ??
			null;

		const index =
			typeof data?.index === "number" && Number.isFinite(data.index)
				? data.index
				: (store?.getState?.()?.queue?.items?.length ?? 0);

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
									queueTarget: {
										videoId,
										...(playlistId ? { playlistId } : {}),
									},
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
					if (store && Array.isArray(items) && items.length) {
						store.dispatch({
							type: "ADD_ITEMS",
							payload: {
								nextQueueItemId: store.getState().queue.nextQueueItemId,
								index,
								items,
								shuffleEnabled: store.getState().queue.shuffleEnabled,
								shouldAssignIds: true,
							},
						});
					}
					resolve();
				},
				() => reject(new Error("queueAdd request failed")),
			);
		});

		return { ok: true as const, videoId, playlistId: playlistId ?? null, index };
	},
};

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
			navigate: async (_ctx, data?: { videoId?: string; playlistId?: string }) => trackControls.navigate(data),
			queueAdd: async (_ctx, data?: { videoId?: string; playlistId?: string; index?: number }) => trackControls.queueAdd(data),
		},
	},
);
