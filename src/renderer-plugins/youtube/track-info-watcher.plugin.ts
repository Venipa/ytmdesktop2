import definePlugin from "@plugins/utils";

export default definePlugin(
	"track-info-watcher",
	{
		enabled: true,
		displayName: "Track Info Watcher",
	},
	{
		afterInit({ domUtils, playerApi, playerUiService, api }) {
			const videoDataChangeLoadedType = ["dataupdated", "dataloaded", "newdata"];
			domUtils.ensureDomLoaded(() => {
				playerApi.addEventListener(
					"onVideoDataChange",
					(ev) => {
						console.log("onVideoDataChange", ev);
						if (ev.playertype !== 1 || !videoDataChangeLoadedType.includes(ev.type)) return;
						const videoData = playerApi.getPlayerResponse();
						if (!videoData) return; // check if newdata has fetched
						const requestData = {
							video: videoData.videoDetails,
							context: (videoData.microformat ? videoData.microformat.microformatDataRenderer : null) || null,
							music:
								videoData.videoDetails.musicVideoType === "MUSIC_VIDEO_TYPE_ATV"
									? {
											album:
												playerUiService.store.store.getState()?.playerPage?.playerOverlay?.playerOverlayRenderer?.browserMediaSession?.browserMediaSessionRenderer?.album?.runs?.[0] // experimental
													?.text,
										}
									: null,
						};
						api.emit("track:info-req", requestData);
					},
					{ passive: true },
				);
			});
		},
	},
);
