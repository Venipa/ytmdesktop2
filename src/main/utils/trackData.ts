import { DiscordActivityStatusDisplayType, DiscordActivityType, type DiscordActivity as Presence } from "@main/lib/discord-rpc/discord-rpc";
import { YoutubeMatcher } from "./youtubeMatcher";

export interface Thumbnails {
	url: string;
	width: number;
	height: number;
}

export interface ThumbnailData {
	thumbnails: Thumbnails[];
}

export interface TrackVideoData {
	videoId: string;
	title: string;
	lengthSeconds: string;
	channelId: string;
	isOwnerViewing: boolean;
	isCrawlable: boolean;
	thumbnail: ThumbnailData;
	averageRating: number;
	allowRatings: boolean;
	viewCount: string;
	author: string;
	isPrivate: boolean;
	isUnpluggedCorpus: boolean;
	musicVideoType: string;
	isLiveContent: boolean;
}

export interface PageOwnerDetails {
	name: string;
	externalChannelId: string;
	youtubeProfileUrl: string;
}

export interface VideoProgressDetails {
	externalVideoId: string;
	durationSeconds: string;
	durationIso8601: string;
}

export interface LinkAlternate {
	hrefUrl: string;
	title: string;
	alternateType: string;
}

export interface TrackMicroFormatData {
	urlCanonical: string;
	title: string;
	description: string;
	thumbnail: ThumbnailData;
	siteName: string;
	appName: string;
	androidPackage: string;
	iosAppStoreId: string;
	iosAppArguments: string;
	ogType: string;
	urlApplinksIos: string;
	urlApplinksAndroid: string;
	urlTwitterIos: string;
	urlTwitterAndroid: string;
	twitterCardType: string;
	twitterSiteHandle: string;
	schemaDotOrgType: string;
	noindex: boolean;
	unlisted: boolean;
	paid: boolean;
	familySafe: boolean;
	tags: string[];
	availableCountries: string[];
	pageOwnerDetails: PageOwnerDetails;
	videoDetails: VideoProgressDetails;
	linkAlternates: LinkAlternate[];
	viewCount: string;
	publishDate: string;
	category: string;
	uploadDate: string;
}
interface TrackMeta {
	thumbnail?: string;
	isAudioExclusive: boolean;
	startedAt: number;
	duration: number;
}
export interface TrackData {
	video: TrackVideoData;
	context: TrackMicroFormatData;
	meta: TrackMeta;
	music?: {
		album: string;
	};
}

export const parseMusicUrlById = (id: string) => `https://music.youtube.com/watch?v=${id}&feature=share`;
export const parseMusicChannelById = (id: string) => `https://music.youtube.com/channel/${id}?feature=share`;
export const parseMusicAlbumById = (ident: string) => `https://music.youtube.com/browse/${encodeURIComponent(ident)}?feature=share`;
export const discordEmbedFromTrack = (track: TrackData, playing: boolean = true, progress: number = 0): Presence => {
	const startDate = playing ? new Date(Date.now() - progress * 1000) : undefined,
		endDate = startDate ? new Date(startDate.getTime() + ~~Number(track.video.lengthSeconds) * 1000) : undefined;

	const detailsUrl = track.video.videoId ? parseMusicUrlById(track.video.videoId) : undefined;
	const stateUrl = track.video.channelId ? parseMusicChannelById(track.video.channelId) : undefined;
	const albumUrl = track.music?.album ? parseMusicAlbumById(track.music.album) : undefined;
	return {
		type: DiscordActivityType.Listening,
		status_display_type: DiscordActivityStatusDisplayType.State,
		details: track.video.title,
		details_url: detailsUrl,
		state: `by ${track.video.author}`,
		state_url: stateUrl,
		timestamps: {
			start: playing ? startDate.getTime() : undefined,
			end: playing ? endDate.getTime() : undefined,
		},
		assets: {
			large_image: track.video.thumbnail.thumbnails.find((x) => YoutubeMatcher.Thumbnail.test(x.url))?.url ?? "logo",
			large_text: track.video.author,
			large_url: albumUrl,
			small_image: playing ? "playx1024" : "pausex1024",
			small_text: `${Number.parseInt(track.video.viewCount)?.toLocaleString("de") || track.video.viewCount} views`,
		},
		instance: false,
		buttons: [
			...(detailsUrl
				? [
						{
							label: "Open in Browser",
							url: detailsUrl,
						},
					]
				: []),
			...(stateUrl
				? [
						{
							label: "View Channel",
							url: stateUrl,
						},
					]
				: []),
		],
	};
};
