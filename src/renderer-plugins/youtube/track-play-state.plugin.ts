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

				let lastPlaying: boolean | null = null;
				let lastProgressBucket = -1;

				const emitPlayState = (channel: string, playing: boolean, progress: number) => {
					const progressBucket = Math.floor((Number(progress) || 0) * 4); // 250ms
					if (playing === lastPlaying && progressBucket === lastProgressBucket) return;
					lastPlaying = playing;
					lastProgressBucket = progressBucket;
					try {
						api.emit(channel, playing, progress);
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
					emitPlayState(IPC_EVENT_NAMES.TRACK_PLAYSTATE_PROGRESS, isPlaying(), progress);
				});
				player.addEventListener("onStateChange", () => {
					emitPlayState(IPC_EVENT_NAMES.TRACK_PLAYSTATE, isPlaying(), player.getCurrentTime());
				});
			});
		},
	},
);
