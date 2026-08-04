import definePlugin from "@plugins/utils";
import IPC_EVENT_NAMES from "@shared/constants/eventNames";

export default definePlugin(
	"track-play-state",
	{
		enabled: true,
		displayName: "Track Play State",
	},
	{
		afterInit({ playerApi, api, domUtils: { ensureDomLoaded, playerApi: getPlayerApi }, log }) {
			ensureDomLoaded(() => {
				const getPlayer = () => getPlayerApi() ?? playerApi;
				const isPlaying = () => getPlayer()?.getPlayerState() === 1;

				const emitPlayState = (channel: string, progress: number) => {
					try {
						api.emit(channel, isPlaying(), progress);
					} catch (err) {
						log.error(`Failed to emit ${channel}`, err);
					}
				};

				const player = getPlayer();
				if (!player) {
					log.error("Player API missing — play state not hooked");
					return;
				}

				player.addEventListener("onVideoProgress", (progress: number) => {
					emitPlayState(IPC_EVENT_NAMES.TRACK_PLAYSTATE_PROGRESS, progress);
				});
				player.addEventListener("onStateChange", () => {
					emitPlayState(IPC_EVENT_NAMES.TRACK_PLAYSTATE, player.getCurrentTime());
				});
			});
		},
	},
);
