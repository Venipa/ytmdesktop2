import definePlugin from "@plugins/utils";
import { trackControls, type NavigatePayload, type SeekPayload } from "./api-controls.cmds";
import { startYtmStoreHook } from "./api-controls.store";

export default definePlugin(
	"api-controls",
	{
		enabled: true,
		displayName: "API controls",
		service: "api",
	},
	{
		afterInit({ log, domUtils }) {
			startYtmStoreHook({ log, domUtils });
		},
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
