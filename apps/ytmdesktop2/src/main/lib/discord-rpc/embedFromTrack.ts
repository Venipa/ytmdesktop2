import { DiscordActivityStatusDisplayType, DiscordActivityType, type DiscordActivity as Presence } from "@main/lib/discord-rpc/discord-rpc";
import { parseMusicAlbumById, parseMusicChannelById, parseMusicUrlById, type TrackData } from "@shared/track/trackData";
import { YoutubeMatcher } from "@shared/track/youtubeMatcher";

export const discordEmbedFromTrack = (track: TrackData, playing: boolean = true, progress: number = 0): Presence => {
	const startDate = playing ? new Date(Date.now() - progress * 1000) : undefined,
		endDate = startDate ? new Date(startDate.getTime() + ~~Number(track.video.lengthSeconds) * 1000) : undefined;

	const detailsUrl = track.video.videoId ? parseMusicUrlById(track.video.videoId) : undefined;
	const stateUrl = track.video.channelId ? parseMusicChannelById(track.video.channelId) : undefined;
	const albumUrl = track.music?.album ? parseMusicAlbumById(track.music.album) : undefined;
	const author = track.video.author;
	const authorUrl = track.video.channelId ? parseMusicChannelById(track.video.channelId) : undefined;
	const title = track.video.title;
	const albumName = track.music?.album ?? title ?? undefined;
	const buttons: Presence["buttons"] = [
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
	];

	return {
		type: DiscordActivityType.Listening,
		status_display_type: DiscordActivityStatusDisplayType.State,
		details: title,
		details_url: detailsUrl,
		state: author,
		state_url: authorUrl,
		timestamps: {
			start: playing && startDate ? startDate.getTime() : undefined,
			end: playing && endDate ? endDate.getTime() : undefined,
		},
		assets: {
			large_image: track.video.thumbnail.thumbnails.find((x) => YoutubeMatcher.Thumbnail.test(x.url))?.url ?? "logo",
			large_text: albumName,
			large_url: albumUrl,
			small_image: playing ? "playx1024" : "pausex1024",
			small_text: `${Number.parseInt(track.video.viewCount)?.toLocaleString("de") || track.video.viewCount} views`,
		},
		instance: false,
		buttons: buttons.length > 0 ? buttons : undefined,
	};
};
