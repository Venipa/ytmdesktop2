import { definePageCmds } from "@plugins/define-bridge";
import { trackControls } from "./api-controls.cmds";
import { getPagePlayerApi } from "./world0/context";

function requirePlayer() {
	const player = getPagePlayerApi();
	if (!player) throw new Error("playerApi not ready");
	return player;
}

/**
 * Page cmd handlers + bridge for api-controls.
 * Safe in world0 (no electron / preload).
 */
export const apiControlsPage = definePageCmds({
	name: "api_controls",
	cmds: {
		toggle: () => trackControls.toggle(requirePlayer()),
		play: () => trackControls.play(requirePlayer()),
		pause: () => trackControls.pause(requirePlayer()),
		next: () => trackControls.next(requirePlayer()),
		prev: () => trackControls.prev(requirePlayer()),
		isPlaying: () => trackControls.isPlaying(requirePlayer()),
		repeat: () => trackControls.repeat(requirePlayer()),
		shuffle: () => trackControls.shuffle(requirePlayer()),
		forward: (data) => trackControls.forward(requirePlayer(), data as Parameters<typeof trackControls.forward>[1]),
		backward: (data) =>
			trackControls.backward(requirePlayer(), data as Parameters<typeof trackControls.backward>[1]),
		seek: (data) => trackControls.seek(requirePlayer(), data as Parameters<typeof trackControls.seek>[1]),
		like: (liked) => trackControls.like(!!liked),
		dislike: (disliked) => trackControls.dislike(!!disliked),
		likeState: () => trackControls.likeState(),
		volume: (data) => trackControls.volume(requirePlayer(), data as Parameters<typeof trackControls.volume>[1]),
		volumeUp: (data) =>
			trackControls.volumeUp(requirePlayer(), data as Parameters<typeof trackControls.volumeUp>[1]),
		volumeDown: (data) =>
			trackControls.volumeDown(requirePlayer(), data as Parameters<typeof trackControls.volumeDown>[1]),
		navigate: (data) => trackControls.navigate(data as Parameters<typeof trackControls.navigate>[0]),
		queueAdd: (data) => trackControls.queueAdd(data as Parameters<typeof trackControls.queueAdd>[0]),
		queueList: () => trackControls.queueList(),
		queueClear: () => trackControls.queueClear(requirePlayer()),
		videoId: () => {
			const data = requirePlayer().getVideoData?.() as { video_id?: string } | undefined;
			return data?.video_id ?? null;
		},
	},
});

export type ApiControlCmd = keyof typeof apiControlsPage.cmds;

export const API_CONTROLS_MSG = apiControlsPage.type;

/** Preload / other plugins: ask page world to run a track control cmd. */
export function requestApiControl<T = unknown>(cmd: ApiControlCmd, ...args: unknown[]): Promise<T> {
	return apiControlsPage.bridge.request<T>(cmd, ...args);
}

export const apiControlPluginCmds = apiControlsPage.pluginCmds;
