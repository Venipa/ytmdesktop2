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

function rendererVideoId(renderer: unknown): string | null {
	if (!renderer || typeof renderer !== "object") return null;
	const r = renderer as Record<string, any>;
	const id = r.videoId ?? r.navigationEndpoint?.watchEndpoint?.videoId;
	return typeof id === "string" && id ? id : null;
}

/** Song↔video pair from YTM playlistPanelVideoWrapperRenderer; null if absent/odd shape. */
function counterpartFromWrapper(wrapper: unknown, activeVideoId: string): string | null {
	if (!wrapper || typeof wrapper !== "object") return null;
	const root = wrapper as Record<string, any>;
	const wrapped = root.playlistPanelVideoWrapperRenderer ?? root;
	const primary = wrapped?.primaryRenderer?.playlistPanelVideoRenderer;
	const counterpart = wrapped?.counterpart?.[0]?.counterpartRenderer?.playlistPanelVideoRenderer;
	const primaryId = rendererVideoId(primary);
	const counterpartId = rendererVideoId(counterpart);
	if (!primaryId || !counterpartId) return null;
	if (primaryId === activeVideoId) return counterpartId;
	if (counterpartId === activeVideoId) return primaryId;
	return null;
}

/** Soft-fail counterpart lookup — player bar then queue DOM. */
function readCounterpartVideoId(activeVideoId: string): string | null {
	try {
		const bar = document.querySelector("ytmusic-app-layout>ytmusic-player-bar") as any;
		const currentItem = bar?.currentItem;
		if (currentItem) {
			const fromWrapper = counterpartFromWrapper(currentItem, activeVideoId);
			if (fromWrapper) return fromWrapper;
			const nested = currentItem.playlistPanelVideoWrapperRenderer;
			if (nested) {
				const fromNested = counterpartFromWrapper(nested, activeVideoId);
				if (fromNested) return fromNested;
			}
			const flatCounterpart =
				currentItem.counterpart?.[0]?.counterpartRenderer?.playlistPanelVideoRenderer ?? currentItem.counterpart?.[0];
			const flatId = rendererVideoId(flatCounterpart);
			if (flatId && flatId !== activeVideoId) return flatId;
		}

		const nodes = document.querySelectorAll(
			"ytmusic-player-queue-item, ytmusic-playlist-panel-video-wrapper-renderer, ytmusic-player-queue ytmusic-player-queue-item",
		);
		for (const node of nodes) {
			const data = (node as any).data ?? (node as any).__data?.data;
			if (!data) continue;
			const found = counterpartFromWrapper(data, activeVideoId);
			if (found) return found;
		}
		return null;
	} catch {
		return null;
	}
}

/** Plain IPC-safe payload — no Polymer / circular refs. */
function buildTrackInfoPayload(videoData: any, album?: { id: string; title: string }) {
	const details = videoData.videoDetails;
	const micro = videoData.microformat?.microformatDataRenderer;
	const videoId = String(details.videoId);
	return {
		video: {
			videoId,
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
		counterpartVideoId: readCounterpartVideoId(videoId),
	};
}

function contentKey(payload: ReturnType<typeof buildTrackInfoPayload>): string {
	return `${payload.video.videoId}|${payload.music?.album ?? ""}|${payload.video.title}|${payload.video.lengthSeconds}|${payload.counterpartVideoId ?? ""}`;
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
