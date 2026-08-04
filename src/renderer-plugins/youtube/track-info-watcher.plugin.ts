import definePlugin from "@plugins/utils";

const VIDEO_DATA_LOADED_TYPES = new Set(["dataupdated", "dataloaded", "newdata"]);
const FIRST_TRACK_POLL_MS = 50;
const FIRST_TRACK_POLL_MAX_MS = 8_000;

export default definePlugin(
	"track-info-watcher",
	{
		enabled: true,
		displayName: "Track Info Watcher",
	},
	{
		afterInit({ domUtils, playerApi, api, log }) {
			domUtils.ensureDomLoaded(() => {
				const getPlayer = () => domUtils.playerApi() ?? playerApi;

				const pushTrackInfo = (): boolean => {
					const player = getPlayer();
					if (!player) return false;

					const videoData = player.getPlayerResponse?.();
					if (!videoData?.videoDetails?.videoId) return false;

					let album: { id: string; title: string } | undefined;
					const currentItem = document.querySelector<any>("ytmusic-app-layout>ytmusic-player-bar")?.currentItem;
					if (currentItem != null) {
						const albumRef = currentItem.longBylineText?.runs?.find(
							(v: any) =>
								v.navigationEndpoint?.browseEndpoint?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig
									?.pageType === "MUSIC_PAGE_TYPE_ALBUM",
						);
						if (albumRef) {
							album = {
								id: albumRef.navigationEndpoint.browseEndpoint.browseId,
								title: albumRef.text,
							};
						}
					}

					const requestData = {
						video: videoData.videoDetails,
						context: videoData.microformat?.microformatDataRenderer ?? null,
						music:
							videoData.videoDetails.musicVideoType === "MUSIC_VIDEO_TYPE_ATV" && album
								? {
										album: album.title,
										albumId: album.id,
									}
								: null,
					};

					try {
						api.emit("track:info-req", requestData);
						return true;
					} catch (err) {
						log.error("Failed to emit track:info-req", err);
						return false;
					}
				};

				const handleVideoDataChange = (ev: { playertype?: number | string; type?: string }) => {
					if (Number(ev?.playertype) !== 1 || !VIDEO_DATA_LOADED_TYPES.has(ev?.type ?? "")) return;
					pushTrackInfo();
				};

				getPlayer()?.addEventListener("onVideoDataChange", handleVideoDataChange);

				// Poll for first track — videoDetails can lag a tick after isReady()
				const startedAt = Date.now();
				const pollFirst = () => {
					if (pushTrackInfo()) return;
					if (Date.now() - startedAt >= FIRST_TRACK_POLL_MAX_MS) return;
					setTimeout(pollFirst, FIRST_TRACK_POLL_MS);
				};
				pollFirst();
			});
		},
	},
);
