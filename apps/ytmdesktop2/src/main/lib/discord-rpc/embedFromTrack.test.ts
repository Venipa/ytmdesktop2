import { describe, expect, test } from "vitest";
import type { TrackData } from "@shared/track/trackData";
import { discordEmbedFromTrack } from "./embedFromTrack";

function makeTrack(): TrackData {
	return {
		video: {
			videoId: "vid",
			title: "Song",
			lengthSeconds: "200",
			channelId: "ch",
			isOwnerViewing: false,
			isCrawlable: true,
			thumbnail: { thumbnails: [] },
			averageRating: 0,
			allowRatings: true,
			viewCount: "0",
			author: "Artist",
			isPrivate: false,
			isUnpluggedCorpus: false,
			musicVideoType: "MUSIC_VIDEO_TYPE_ATV",
			isLiveContent: false,
		},
		context: {} as TrackData["context"],
		meta: {
			isAudioExclusive: true,
			counterpartVideoId: null,
			startedAt: 1000,
			duration: 200,
		},
		music: { album: "Album" },
	};
}

describe("discordEmbedFromTrack", () => {
	test("paused omits timestamps so Discord timer stops", () => {
		const embed = discordEmbedFromTrack(makeTrack(), false, 10);
		expect(embed.timestamps).toBeUndefined();
		expect(embed.assets?.small_image).toBe("pausex1024");
	});

	test("resume restores start/end timestamps", () => {
		const paused = discordEmbedFromTrack(makeTrack(), false, 42);
		expect(paused.timestamps).toBeUndefined();
		const resumed = discordEmbedFromTrack(makeTrack(), true, 42);
		expect(resumed.timestamps?.start).toEqual(expect.any(Number));
		expect(resumed.timestamps?.end).toEqual(expect.any(Number));
		expect(resumed.assets?.small_image).toBe("playx1024");
		expect((resumed.timestamps?.end ?? 0) - (resumed.timestamps?.start ?? 0)).toBe(200_000);
	});
});
