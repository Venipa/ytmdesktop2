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
		const pressed = btn?.getAttribute("aria-pressed") === "true";
		if (btn && pressed !== liked) btn.click();
		return document.querySelector<HTMLElement>("#like-button-renderer #button-shape-like.like button")?.getAttribute("aria-pressed") === "true";
	},
	dislike: async (disliked: boolean) => {
		const btn = document.querySelector<HTMLElement>("#like-button-renderer #button-shape-dislike.dislike button");
		const pressed = btn?.getAttribute("aria-pressed") === "true";
		if (btn && pressed !== disliked) btn.click();
		return document.querySelector<HTMLElement>("#like-button-renderer #button-shape-dislike.dislike button")?.getAttribute("aria-pressed") === "true";
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
		},
	},
);
