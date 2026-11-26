import { describe, expect, it } from "vitest";
import { artistsFromBylineRuns, bylineRunsForVideo } from "./byline";

const runs = (...texts: string[]) => texts.map((text) => ({ text }));

describe("artistsFromBylineRuns", () => {
	it("splits artist runs and stops at the first section separator", () => {
		expect(artistsFromBylineRuns(runs("A", ", ", "B", " & ", "C", " • ", "Album", " • ", "2024"))).toEqual(["A", "B", "C"]);
		expect(artistsFromBylineRuns(runs("Earth, Wind & Fire", " • ", "September"))).toEqual(["Earth, Wind & Fire"]);
		expect(artistsFromBylineRuns(undefined)).toEqual([]);
	});
});

describe("bylineRunsForVideo", () => {
	const song = runs("A", " & ", "B", " • ", "Album");
	const video = runs("A", " & ", "B", " • ", "1M views");
	const entry = (videoId: string, byline: typeof song) => ({ playlistPanelVideoRenderer: { videoId, longBylineText: { runs: byline } } });
	const wrapper = {
		playlistPanelVideoWrapperRenderer: {
			primaryRenderer: entry("song", song),
			counterpart: [{ counterpartRenderer: entry("video", video) }],
		},
	};

	it("picks the entry of the playing video, also inside a Song/Video wrapper", () => {
		expect(bylineRunsForVideo({ videoId: "song", longBylineText: { runs: song } }, "song")).toBe(song);
		expect(bylineRunsForVideo(wrapper, "song")).toBe(song);
		expect(bylineRunsForVideo(wrapper, "video")).toBe(video);
		expect(bylineRunsForVideo({ navigationEndpoint: { watchEndpoint: { videoId: "song" } }, longBylineText: { runs: song } }, "song")).toBe(song);
	});

	it("returns nothing while the item belongs to the previous video", () => {
		expect(bylineRunsForVideo(entry("previous", song), "song")).toBeUndefined();
		expect(bylineRunsForVideo(wrapper, "other")).toBeUndefined();
		expect(bylineRunsForVideo({ longBylineText: { runs: song } }, "song")).toBeUndefined();
		expect(bylineRunsForVideo(undefined, "song")).toBeUndefined();
	});
});
