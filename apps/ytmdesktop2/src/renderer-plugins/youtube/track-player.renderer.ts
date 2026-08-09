import type { PlayerApi } from "ytm-client-api";
import type { RendererPluginRegistration } from "./world0/types";
import { getPagePlayerApi } from "./world0/context";

type PlayerEventTarget = {
	addEventListener?: (event: string, handler: (...args: never[]) => void) => void;
	removeEventListener?: (event: string, handler: (...args: never[]) => void) => void;
};

function asEventTarget(player: PlayerApi | null): PlayerEventTarget | null {
	return player as unknown as PlayerEventTarget | null;
}

const VIDEO_DATA_LOADED_TYPES: Record<string, 1> = { dataupdated: 1, dataloaded: 1, newdata: 1 };
const FIRST_TRACK_POLL_MS = 50;
const FIRST_TRACK_POLL_MAX_MS = 8000;
const ALBUM_POLL_MS = 100;
const ALBUM_POLL_MAX_MS = 3000;

type Thumb = { url: string; width: number; height: number };

function pickThumbs(raw: unknown): Thumb[] {
	if (!Array.isArray(raw)) return [];
	const out: Thumb[] = [];
	for (const t of raw) {
		const item = (t ?? {}) as { url?: string; width?: number; height?: number };
		const url = String(item.url || "");
		if (!url) continue;
		out.push({ url, width: Number(item.width || 0), height: Number(item.height || 0) });
	}
	return out;
}

function rendererVideoId(renderer: unknown): string | null {
	if (!renderer || typeof renderer !== "object") return null;
	const r = renderer as {
		videoId?: string;
		navigationEndpoint?: { watchEndpoint?: { videoId?: string } };
	};
	const id = r.videoId || r.navigationEndpoint?.watchEndpoint?.videoId;
	return typeof id === "string" && id ? id : null;
}

function counterpartFromWrapper(wrapper: unknown, activeVideoId: string): string | null {
	if (!wrapper || typeof wrapper !== "object") return null;
	const wrapped = (wrapper as { playlistPanelVideoWrapperRenderer?: unknown }).playlistPanelVideoWrapperRenderer ?? wrapper;
	if (!wrapped || typeof wrapped !== "object") return null;
	const w = wrapped as {
		primaryRenderer?: { playlistPanelVideoRenderer?: unknown };
		counterpart?: Array<{ counterpartRenderer?: { playlistPanelVideoRenderer?: unknown } }>;
	};
	const primary = w.primaryRenderer?.playlistPanelVideoRenderer;
	const counterpart = w.counterpart?.[0]?.counterpartRenderer?.playlistPanelVideoRenderer;
	const primaryId = rendererVideoId(primary);
	const counterpartId = rendererVideoId(counterpart);
	if (!primaryId || !counterpartId) return null;
	if (primaryId === activeVideoId) return counterpartId;
	if (counterpartId === activeVideoId) return primaryId;
	return null;
}

function readCounterpartVideoId(activeVideoId: string): string | null {
	try {
		const bar = document.querySelector("ytmusic-app-layout>ytmusic-player-bar") as {
			currentItem?: Record<string, unknown>;
		} | null;
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
				(currentItem.counterpart as Array<{ counterpartRenderer?: { playlistPanelVideoRenderer?: unknown } }> | undefined)?.[0]
					?.counterpartRenderer?.playlistPanelVideoRenderer ??
				(currentItem.counterpart as unknown[] | undefined)?.[0];
			const flatId = rendererVideoId(flatCounterpart);
			if (flatId && flatId !== activeVideoId) return flatId;
		}
		const nodes = document.querySelectorAll(
			"ytmusic-player-queue-item, ytmusic-playlist-panel-video-wrapper-renderer, ytmusic-player-queue ytmusic-player-queue-item",
		);
		for (const node of Array.from(nodes)) {
			const el = node as { data?: unknown; __data?: { data?: unknown } };
			const data = el.data ?? el.__data?.data;
			if (!data) continue;
			const found = counterpartFromWrapper(data, activeVideoId);
			if (found) return found;
		}
	} catch {
		/* ignore */
	}
	return null;
}

function readAlbum(): { id: string; title: string } | undefined {
	try {
		const bar = document.querySelector("ytmusic-app-layout>ytmusic-player-bar") as {
			currentItem?: {
				longBylineText?: {
					runs?: Array<{
						text?: string;
						navigationEndpoint?: {
							browseEndpoint?: {
								browseId?: string;
								browseEndpointContextSupportedConfigs?: {
									browseEndpointContextMusicConfig?: { pageType?: string };
								};
							};
						};
					}>;
				};
			};
		} | null;
		const runs = bar?.currentItem?.longBylineText?.runs;
		if (!runs) return undefined;
		for (const v of runs) {
			const pageType =
				v?.navigationEndpoint?.browseEndpoint?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig
					?.pageType;
			if (pageType === "MUSIC_PAGE_TYPE_ALBUM") {
				return {
					id: String(v.navigationEndpoint?.browseEndpoint?.browseId || ""),
					title: String(v.text || ""),
				};
			}
		}
	} catch {
		/* ignore */
	}
	return undefined;
}

function buildPayload(videoData: {
	videoDetails: Record<string, unknown> & {
		videoId: string;
		thumbnail?: { thumbnails?: unknown };
		musicVideoType?: string;
	};
	microformat?: { microformatDataRenderer?: Record<string, unknown> };
}, album: { id: string; title: string } | undefined) {
	const details = videoData.videoDetails;
	const micro = videoData.microformat?.microformatDataRenderer;
	const videoId = String(details.videoId);
	const pageOwner = (micro?.pageOwnerDetails ?? {}) as Record<string, unknown>;
	const microVideo = (micro?.videoDetails ?? {}) as Record<string, unknown>;
	return {
		video: {
			videoId,
			title: String(details.title || ""),
			lengthSeconds: String(details.lengthSeconds || ""),
			channelId: String(details.channelId || ""),
			isOwnerViewing: !!details.isOwnerViewing,
			isCrawlable: !!details.isCrawlable,
			thumbnail: { thumbnails: pickThumbs(details.thumbnail?.thumbnails) },
			averageRating: Number(details.averageRating || 0),
			allowRatings: !!details.allowRatings,
			viewCount: String(details.viewCount || ""),
			author: String(details.author || ""),
			isPrivate: !!details.isPrivate,
			isUnpluggedCorpus: !!details.isUnpluggedCorpus,
			musicVideoType: String(details.musicVideoType || ""),
			isLiveContent: !!details.isLiveContent,
		},
		context: micro
			? {
					urlCanonical: String(micro.urlCanonical || ""),
					title: String(micro.title || ""),
					description: String(micro.description || ""),
					thumbnail: { thumbnails: pickThumbs((micro.thumbnail as { thumbnails?: unknown } | undefined)?.thumbnails) },
					siteName: String(micro.siteName || ""),
					appName: String(micro.appName || ""),
					androidPackage: String(micro.androidPackage || ""),
					iosAppStoreId: String(micro.iosAppStoreId || ""),
					iosAppArguments: String(micro.iosAppArguments || ""),
					ogType: String(micro.ogType || ""),
					urlApplinksIos: String(micro.urlApplinksIos || ""),
					urlApplinksAndroid: String(micro.urlApplinksAndroid || ""),
					urlTwitterIos: String(micro.urlTwitterIos || ""),
					urlTwitterAndroid: String(micro.urlTwitterAndroid || ""),
					twitterCardType: String(micro.twitterCardType || ""),
					twitterSiteHandle: String(micro.twitterSiteHandle || ""),
					schemaDotOrgType: String(micro.schemaDotOrgType || ""),
					noindex: !!micro.noindex,
					unlisted: !!micro.unlisted,
					paid: !!micro.paid,
					familySafe: !!micro.familySafe,
					tags: Array.isArray(micro.tags) ? micro.tags.map(String) : [],
					availableCountries: Array.isArray(micro.availableCountries) ? micro.availableCountries.map(String) : [],
					pageOwnerDetails: {
						name: String(pageOwner.name || ""),
						externalChannelId: String(pageOwner.externalChannelId || ""),
						youtubeProfileUrl: String(pageOwner.youtubeProfileUrl || ""),
					},
					videoDetails: {
						externalVideoId: String(microVideo.externalVideoId || details.videoId || ""),
						durationSeconds: String(microVideo.durationSeconds || details.lengthSeconds || ""),
						durationIso8601: String(microVideo.durationIso8601 || ""),
					},
					linkAlternates: [] as unknown[],
					viewCount: String(micro.viewCount || ""),
					publishDate: String(micro.publishDate || ""),
					category: String(micro.category || ""),
					uploadDate: String(micro.uploadDate || ""),
				}
			: null,
		music: details.musicVideoType === "MUSIC_VIDEO_TYPE_ATV" && album ? { album: album.title, albumId: album.id } : null,
		counterpartVideoId: readCounterpartVideoId(videoId),
		restartListen: false as boolean | undefined,
	};
}

function contentKey(payload: ReturnType<typeof buildPayload>): string {
	return (
		payload.video.videoId +
		"|" +
		((payload.music && payload.music.album) || "") +
		"|" +
		payload.video.title +
		"|" +
		payload.video.lengthSeconds +
		"|" +
		(payload.counterpartVideoId || "")
	);
}

const trackPlayerRenderer: RendererPluginRegistration = {
	id: "track-player",
	enabled: true,
	start(ctx) {
		let lastVideoId: string | null = null;
		const titleEl = document.querySelector("title");
		if (!titleEl) return;

		const observer = new MutationObserver(() => {
			const el = document.querySelector("a.ytp-title-link.yt-uix-sessionlink") as HTMLAnchorElement | null;
			if (!el?.href) return;
			try {
				const videoId = new URLSearchParams(el.href.split("?")[1]).get("v");
				if (!videoId || videoId === lastVideoId) return;
				lastVideoId = videoId;
				ctx.ytmd?.emit("track:title-change", videoId);
			} catch {
				/* ignore */
			}
		});
		observer.observe(titleEl, { subtree: true, characterData: true, childList: true });
		return () => observer.disconnect();
	},
	onPlayerApiReady(playerApi, ctx) {
		let lastKey: string | null = null;
		let disposed = false;
		let firstPollTimer: ReturnType<typeof setTimeout> | null = null;
		let albumPollTimer: ReturnType<typeof setTimeout> | null = null;
		let hookedInfoPlayer: PlayerApi | null = null;
		let lastPlaying: boolean | null = null;
		let lastProgressBucket = -1;
		let hookedPlayPlayer: PlayerApi | null = null;

		const clearAlbumPoll = () => {
			if (albumPollTimer === null) return;
			clearTimeout(albumPollTimer);
			albumPollTimer = null;
		};

		const emitInfo = (payload: ReturnType<typeof buildPayload>) => {
			if (!ctx.ytmd?.emit) return false;
			ctx.ytmd.emit("track:info-req", payload);
			return true;
		};

		const pushTrackInfo = (opts?: { restartListen?: boolean }) => {
			const player = getPagePlayerApi() ?? playerApi;
			if (!player || typeof player.getPlayerResponse !== "function") return false;
			let videoData: Parameters<typeof buildPayload>[0];
			try {
				videoData = player.getPlayerResponse() as Parameters<typeof buildPayload>[0];
			} catch {
				return false;
			}
			if (!videoData?.videoDetails?.videoId) return false;
			const payload = buildPayload(videoData, readAlbum());
			const key = contentKey(payload);
			const restartListen = !!opts?.restartListen;
			if (!restartListen && key === lastKey) return true;
			payload.restartListen = restartListen;
			if (!emitInfo(payload)) return false;
			lastKey = key;
			if (payload.video.musicVideoType === "MUSIC_VIDEO_TYPE_ATV" && !payload.music) {
				armAlbumPoll(payload.video.videoId);
			} else {
				clearAlbumPoll();
			}
			return true;
		};

		const armAlbumPoll = (videoId: string) => {
			clearAlbumPoll();
			const startedAt = Date.now();
			const tick = () => {
				if (disposed) return;
				const player = getPagePlayerApi();
				let currentId = "";
				try {
					currentId = String(player?.getPlayerResponse?.()?.videoDetails?.videoId || "");
				} catch {
					currentId = "";
				}
				if (currentId !== videoId) return;
				if (readAlbum()) {
					pushTrackInfo();
					return;
				}
				if (Date.now() - startedAt >= ALBUM_POLL_MAX_MS) return;
				albumPollTimer = setTimeout(tick, ALBUM_POLL_MS);
			};
			albumPollTimer = setTimeout(tick, ALBUM_POLL_MS);
		};

		const handleVideoDataChange = (ev: { type?: string; playertype?: number }) => {
			const type = String(ev?.type || "").toLowerCase();
			if (!VIDEO_DATA_LOADED_TYPES[type]) return;
			if (ev?.playertype != null && Number(ev.playertype) !== 1) return;
			const restartListen = type === "dataloaded" || type === "newdata";
			pushTrackInfo({ restartListen });
		};

		const hookInfoPlayer = () => {
			const player = getPagePlayerApi() ?? playerApi;
			if (!player || player === hookedInfoPlayer) return !!player;
			const prev = asEventTarget(hookedInfoPlayer);
			try {
				prev?.removeEventListener?.("onVideoDataChange", handleVideoDataChange as (...args: never[]) => void);
			} catch {
				/* ignore */
			}
			hookedInfoPlayer = player;
			try {
				asEventTarget(player)?.addEventListener?.("onVideoDataChange", handleVideoDataChange as (...args: never[]) => void);
			} catch {
				/* ignore */
			}
			return true;
		};

		const emitPlayState = (channel: string, playing: boolean, progress: number) => {
			const progressBucket = Math.floor((Number(progress) || 0) * 4);
			if (playing === lastPlaying && progressBucket === lastProgressBucket) return;
			lastPlaying = playing;
			lastProgressBucket = progressBucket;
			ctx.ytmd?.emit(channel, playing, progress);
		};

		const isPlaying = (player: PlayerApi) => {
			try {
				return player.getPlayerState() === 1;
			} catch {
				return false;
			}
		};

		const onProgress = (progress: number) => {
			const player = getPagePlayerApi() ?? playerApi;
			if (!player) return;
			emitPlayState("track:play-state-progress", isPlaying(player), progress);
		};

		const onStateChange = () => {
			const player = getPagePlayerApi() ?? playerApi;
			if (!player) return;
			let time = 0;
			try {
				time = player.getCurrentTime();
			} catch {
				/* ignore */
			}
			emitPlayState("track:play-state", isPlaying(player), time);
		};

		const hookPlayPlayer = () => {
			const player = getPagePlayerApi() ?? playerApi;
			if (!player || player === hookedPlayPlayer) return !!player;
			const prev = asEventTarget(hookedPlayPlayer);
			try {
				prev?.removeEventListener?.("onVideoProgress", onProgress as (...args: never[]) => void);
				prev?.removeEventListener?.("onStateChange", onStateChange as (...args: never[]) => void);
			} catch {
				/* ignore */
			}
			hookedPlayPlayer = player;
			try {
				const next = asEventTarget(player);
				next?.addEventListener?.("onVideoProgress", onProgress as (...args: never[]) => void);
				next?.addEventListener?.("onStateChange", onStateChange as (...args: never[]) => void);
			} catch {
				/* ignore */
			}
			return true;
		};

		hookInfoPlayer();
		hookPlayPlayer();
		const startedAt = Date.now();
		const pollFirst = () => {
			if (disposed) return;
			hookInfoPlayer();
			hookPlayPlayer();
			if (pushTrackInfo()) return;
			if (Date.now() - startedAt >= FIRST_TRACK_POLL_MAX_MS) return;
			firstPollTimer = setTimeout(pollFirst, FIRST_TRACK_POLL_MS);
		};
		pollFirst();

		const onUnload = () => {
			disposed = true;
			if (firstPollTimer !== null) clearTimeout(firstPollTimer);
			clearAlbumPoll();
			try {
				asEventTarget(hookedInfoPlayer)?.removeEventListener?.(
					"onVideoDataChange",
					handleVideoDataChange as (...args: never[]) => void,
				);
				asEventTarget(hookedPlayPlayer)?.removeEventListener?.(
					"onVideoProgress",
					onProgress as (...args: never[]) => void,
				);
				asEventTarget(hookedPlayPlayer)?.removeEventListener?.(
					"onStateChange",
					onStateChange as (...args: never[]) => void,
				);
			} catch {
				/* ignore */
			}
		};
		window.addEventListener("beforeunload", onUnload, { once: true });
		ctx.log.debug("track-player renderer hooked");
	},
};

export default trackPlayerRenderer;
