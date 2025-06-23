import definePlugin from "@plugins/utils";
import { PlayerApi } from "ytm-client-api";

// todo
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
	},
	{
		afterInit({ log, playerApi, domUtils }) {
			domUtils.ensureDomLoaded(() => {
				function setTimeSkip(_ev, data: { time: number; type?: "seek" }) {
					if (data && typeof data.time === "number") {
						if (playerApi?.seekTo) {
							if (data.type === "seek") playerApi.seekTo(data.time / 1000);
							else playerApi.seekBy(data.time / 1000);
						}
					}
				}
				window.ipcRenderer.on("track:seek", setTimeSkip);
				window.ipcRenderer.on("track:control", async (_ev, data) => {
					if (!data || typeof data !== "object") return;
					const { type } = data;
					try {
						const handler = trackControls[type as keyof typeof trackControls];
						if (!handler) return;
						// not ready yet
						if (!playerApi) return;

						const handleResult = await Promise.resolve(handler(playerApi));
						window.api.emit("track:control/response", {
							type,
							data: handleResult,
						});
					} catch (e) {
						log.error(e);
					}
				});
			});
		},
	},
);
