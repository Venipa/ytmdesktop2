import IPC_EVENT_NAMES from "@main/utils/eventNames";
import definePlugin from "@plugins/utils";

export default definePlugin(
	"track-play-state",
	{
		enabled: true,
		displayName: "Track Play State",
	},
	{
		afterInit({ playerApi, domUtils: { ensureDomLoaded } }) {
			const isPlaying = () => playerApi.getPlayerState() === 1;
			ensureDomLoaded(() => {
				playerApi.addEventListener(
					"onVideoProgress",
					(progress) => {
						window.api.emit(IPC_EVENT_NAMES.TRACK_PLAYSTATE_PROGRESS, isPlaying(), progress);
					},
					{ passive: true },
				);
				playerApi.addEventListener("onStateChange", () => {
					window.api.emit(IPC_EVENT_NAMES.TRACK_PLAYSTATE, isPlaying(), playerApi.getCurrentTime());
				});
			});
		},
	},
);
