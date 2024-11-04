import { Presence } from "discord-rpc";
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
}

export const parseMusicUrlById = (id: string) =>
  `https://music.youtube.com/watch?v=${id}&feature=share`;
export const parseMusicChannelById = (id: string) =>
  `https://music.youtube.com/channel/${id}?feature=share`;
export const discordEmbedFromTrack = (
  track: TrackData,
  playing: boolean = true,
  progress: number = 0,
): Presence => {
  const startDate = progress ? new Date(Date.now() - progress * 1000) : new Date(),
    endDate = new Date(startDate.getTime() + ~~Number(track.video.lengthSeconds) * 1000);
  return {
    details: track.video.title,
    state: `by ${track.video.author}`,
    startTimestamp: playing ? startDate : null,
    endTimestamp: playing ? endDate : null,
    largeImageKey:
      track.video.thumbnail.thumbnails.find((x) => YoutubeMatcher.Thumbnail.test(x.url))?.url ??
      "logo",
    smallImageKey: playing ? "playx1024" : "pausex1024",
    smallImageText: `${
      Number.parseInt(track.video.viewCount)?.toLocaleString("de") || track.video.viewCount
    } views`,
    buttons: [
      ...(track.video.videoId
        ? [
            {
              label: "Open in Browser",
              url: parseMusicUrlById(track.video.videoId),
            },
          ]
        : []),
      ...(track.video.channelId
        ? [
            {
              label: "View Channel",
              url: parseMusicChannelById(track.video.channelId),
            },
          ]
        : []),
    ],
  };
};
