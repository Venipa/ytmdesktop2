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
				const handleVideoDataChange = (ev: any) => {
					console.log("onVideoDataChange", ev);
					if (ev.playertype !== 1 || !videoDataChangeLoadedType.includes(ev.type)) return;
					const videoData = playerApi.getPlayerResponse();
					if (!videoData) return; // check if newdata has fetched
					let album: { id: string; title: string } | undefined;
					let currentItem = document.querySelector<any>("ytmusic-app-layout>ytmusic-player-bar")?.currentItem;
					if (currentItem !== null && currentItem !== undefined) {
						const albumRef = currentItem.longBylineText.runs.find(
							(v: any) => v.navigationEndpoint?.browseEndpoint?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType === "MUSIC_PAGE_TYPE_ALBUM",
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
						context: (videoData.microformat ? videoData.microformat.microformatDataRenderer : null) || null,
						music:
							videoData.videoDetails.musicVideoType === "MUSIC_VIDEO_TYPE_ATV" && album
								? {
										album: album.title,
										albumId: album.id,
									}
								: null,
					};
					api.emit("track:info-req", requestData);
				};
				playerApi.addEventListener("onVideoDataChange", handleVideoDataChange, { passive: true });
			});
		},
	},
);
