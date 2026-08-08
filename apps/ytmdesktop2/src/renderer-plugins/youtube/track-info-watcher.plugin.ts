import definePlugin from "@plugins/utils";

const VIDEO_DATA_LOADED_TYPES = new Set(["dataupdated", "dataloaded", "newdata"]);
const FIRST_TRACK_POLL_MS = 50;
const FIRST_TRACK_POLL_MAX_MS = 8_000;
const ALBUM_POLL_MS = 100;
const ALBUM_POLL_MAX_MS = 3_000;

type PlainThumb = { url: string; width: number; height: number };

function pickThumbs(raw: any): PlainThumb[] {
	if (!Array.isArray(raw)) return [];
	return raw
		.map((t: any) => ({
			url: String(t?.url ?? ""),
			width: Number(t?.width ?? 0),
			height: Number(t?.height ?? 0),
		}))
		.filter((t) => !!t.url);
}

/** Plain IPC-safe payload — no Polymer / circular refs. */
function buildTrackInfoPayload(videoData: any, album?: { id: string; title: string }) {
	const details = videoData.videoDetails;
	const micro = videoData.microformat?.microformatDataRenderer;
	return {
		video: {
			videoId: String(details.videoId),
			title: String(details.title ?? ""),
			lengthSeconds: String(details.lengthSeconds ?? ""),
			channelId: String(details.channelId ?? ""),
			isOwnerViewing: !!details.isOwnerViewing,
			isCrawlable: !!details.isCrawlable,
			thumbnail: { thumbnails: pickThumbs(details.thumbnail?.thumbnails) },
			averageRating: Number(details.averageRating ?? 0),
			allowRatings: !!details.allowRatings,
			viewCount: String(details.viewCount ?? ""),
			author: String(details.author ?? ""),
			isPrivate: !!details.isPrivate,
			isUnpluggedCorpus: !!details.isUnpluggedCorpus,
			musicVideoType: String(details.musicVideoType ?? ""),
			isLiveContent: !!details.isLiveContent,
		},
		context: micro
			? {
					urlCanonical: String(micro.urlCanonical ?? ""),
					title: String(micro.title ?? ""),
					description: String(micro.description ?? ""),
					thumbnail: { thumbnails: pickThumbs(micro.thumbnail?.thumbnails) },
					siteName: String(micro.siteName ?? ""),
					appName: String(micro.appName ?? ""),
					androidPackage: String(micro.androidPackage ?? ""),
					iosAppStoreId: String(micro.iosAppStoreId ?? ""),
					iosAppArguments: String(micro.iosAppArguments ?? ""),
					ogType: String(micro.ogType ?? ""),
					urlApplinksIos: String(micro.urlApplinksIos ?? ""),
					urlApplinksAndroid: String(micro.urlApplinksAndroid ?? ""),
					urlTwitterIos: String(micro.urlTwitterIos ?? ""),
					urlTwitterAndroid: String(micro.urlTwitterAndroid ?? ""),
					twitterCardType: String(micro.twitterCardType ?? ""),
					twitterSiteHandle: String(micro.twitterSiteHandle ?? ""),
					schemaDotOrgType: String(micro.schemaDotOrgType ?? ""),
					noindex: !!micro.noindex,
					unlisted: !!micro.unlisted,
					paid: !!micro.paid,
					familySafe: !!micro.familySafe,
					tags: Array.isArray(micro.tags) ? micro.tags.map(String) : [],
					availableCountries: Array.isArray(micro.availableCountries) ? micro.availableCountries.map(String) : [],
					pageOwnerDetails: {
						name: String(micro.pageOwnerDetails?.name ?? ""),
						externalChannelId: String(micro.pageOwnerDetails?.externalChannelId ?? ""),
						youtubeProfileUrl: String(micro.pageOwnerDetails?.youtubeProfileUrl ?? ""),
					},
					videoDetails: {
						externalVideoId: String(micro.videoDetails?.externalVideoId ?? details.videoId ?? ""),
						durationSeconds: String(micro.videoDetails?.durationSeconds ?? details.lengthSeconds ?? ""),
						durationIso8601: String(micro.videoDetails?.durationIso8601 ?? ""),
					},
					linkAlternates: [],
					viewCount: String(micro.viewCount ?? ""),
					publishDate: String(micro.publishDate ?? ""),
					category: String(micro.category ?? ""),
					uploadDate: String(micro.uploadDate ?? ""),
				}
			: null,
		music:
			details.musicVideoType === "MUSIC_VIDEO_TYPE_ATV" && album
				? { album: album.title, albumId: album.id }
				: null,
	};
}

function contentKey(payload: ReturnType<typeof buildTrackInfoPayload>): string {
	return `${payload.video.videoId}|${payload.music?.album ?? ""}|${payload.video.title}|${payload.video.lengthSeconds}`;
}

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
				let lastKey: string | null = null;
				let disposed = false;
				let firstPollTimer: ReturnType<typeof setTimeout> | null = null;
				let albumPollTimer: ReturnType<typeof setTimeout> | null = null;

				const clearAlbumPoll = () => {
					if (albumPollTimer === null) return;
					clearTimeout(albumPollTimer);
					albumPollTimer = null;
				};

				const readAlbum = (): { id: string; title: string } | undefined => {
					const currentItem = document.querySelector<any>("ytmusic-app-layout>ytmusic-player-bar")?.currentItem;
					if (currentItem == null) return undefined;
					const albumRef = currentItem.longBylineText?.runs?.find(
						(v: any) =>
							v.navigationEndpoint?.browseEndpoint?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig
								?.pageType === "MUSIC_PAGE_TYPE_ALBUM",
					);
					if (!albumRef) return undefined;
					return {
						id: String(albumRef.navigationEndpoint.browseEndpoint.browseId ?? ""),
						title: String(albumRef.text ?? ""),
					};
				};

				const armAlbumPoll = (videoId: string) => {
					clearAlbumPoll();
					const startedAt = Date.now();
					const tick = () => {
						if (disposed) return;
						const player = getPlayer();
						const currentId = player?.getPlayerResponse?.()?.videoDetails?.videoId;
						if (String(currentId ?? "") !== videoId) return;
						if (readAlbum()) {
							pushTrackInfo();
							return;
						}
						if (Date.now() - startedAt >= ALBUM_POLL_MAX_MS) return;
						albumPollTimer = setTimeout(tick, ALBUM_POLL_MS);
					};
					albumPollTimer = setTimeout(tick, ALBUM_POLL_MS);
				};

				const pushTrackInfo = (): boolean => {
					const player = getPlayer();
					if (!player) return false;

					const videoData = player.getPlayerResponse?.();
					if (!videoData?.videoDetails?.videoId) return false;

					const payload = buildTrackInfoPayload(videoData, readAlbum());
					const key = contentKey(payload);
					if (key === lastKey) return true;

					try {
						api.emit("track:info-req", payload);
						lastKey = key;
						if (payload.video.musicVideoType === "MUSIC_VIDEO_TYPE_ATV" && !payload.music) {
							armAlbumPoll(payload.video.videoId);
						} else {
							clearAlbumPoll();
						}
						return true;
					} catch (err) {
						log.error("Failed to emit track:info-req", err);
						return false;
					}
				};

				const handleVideoDataChange = (ev: { playertype?: number | string; type?: string }) => {
					const type = String(ev?.type ?? "").toLowerCase();
					if (!VIDEO_DATA_LOADED_TYPES.has(type)) return;
					// Main player is playertype 1; undefined = still try (YTM sometimes omits)
					if (ev?.playertype != null && Number(ev.playertype) !== 1) return;
					pushTrackInfo();
				};

				const player = getPlayer();
				player?.addEventListener("onVideoDataChange", handleVideoDataChange);

				const startedAt = Date.now();
				const pollFirst = () => {
					if (disposed) return;
					if (pushTrackInfo()) return;
					if (Date.now() - startedAt >= FIRST_TRACK_POLL_MAX_MS) return;
					firstPollTimer = setTimeout(pollFirst, FIRST_TRACK_POLL_MS);
				};
				pollFirst();

				window.addEventListener(
					"beforeunload",
					() => {
						disposed = true;
						if (firstPollTimer !== null) clearTimeout(firstPollTimer);
						clearAlbumPoll();
						try {
							getPlayer()?.removeEventListener?.("onVideoDataChange", handleVideoDataChange);
						} catch {
							/* player may already be gone */
						}
					},
					{ once: true },
				);
			});
		},
	},
);
