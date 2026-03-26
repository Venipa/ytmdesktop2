import definePlugin from "@plugins/utils";
import { PlayerApi } from "ytm-client-api";

const trackControls: Record<string, (playerApi: PlayerApi) => any> = {
	toggle: (player) => {
		const state = player.getPlayerStateObject();
		if (!state) throw new Error("Player state not found");
		state.isPlaying ? player.pauseVideo() : player.playVideo();
		return {
			isPlaying: state.isPlaying,
			time: player.getCurrentTime(),
		};
	},
	play: (playerApi) => {
		playerApi.playVideo();
		return {
			isPlaying: true,
			time: playerApi.getCurrentTime(),
		};
	},
	pause: (playerApi) => {
		playerApi.pauseVideo();
		return {
			isPlaying: false,
			time: playerApi.getCurrentTime(),
		};
	},
	next: (playerApi) => playerApi.nextVideo(),
	prev: (playerApi) => playerApi.previousVideo(),
	isPlaying: (player) => {
		const state = player.getPlayerStateObject();
		if (!state) return;
		return state.isPlaying;
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
			toggle: async ({ playerApi }) => {
        return await trackControls.toggle(playerApi);
			},
			play: async ({ playerApi }) => {
				return await trackControls.play(playerApi);
			},
			pause: async ({ playerApi }) => {
				return await trackControls.pause(playerApi);
			},
			next: async ({ playerApi }) => {
				return await trackControls.next(playerApi);
			},
			prev: async ({ playerApi }) => {
				return await trackControls.prev(playerApi);
			},
			isPlaying: async ({ playerApi }) => {
				return await trackControls.isPlaying(playerApi);
			},
			repeat: async ({ playerApi }) => {
				return await trackControls.repeat(playerApi);
			},
			shuffle: async ({ playerApi }) => {
				return await trackControls.shuffle(playerApi);
			},
      forward: async ({ playerApi }) => {
        return await trackControls.forward(playerApi);
      },
      backward: async ({ playerApi }) => {
        return await trackControls.backward(playerApi);
      },
      seek: async ({ playerApi }) => {
        return await trackControls.seek(playerApi);
      },
		},
	},
);
