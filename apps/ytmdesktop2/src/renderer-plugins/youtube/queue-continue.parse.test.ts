import { describe, expect, it } from "vitest";
import { parseNextPanel, queueItemHitsVideoId, queueItemVideoId, remainingAfterIndex } from "./queue-continue.parse";

describe("parseNextPanel", () => {
	it("reads contents and nextContinuationData from nested playlistPanelContinuation", () => {
		const item = { playlistPanelVideoRenderer: { videoId: "abcdefghijk" } };
		const res = {
			contents: {
				singleColumnMusicWatchNextResultsRenderer: {
					tabbedRenderer: {
						watchNextTabbedResultsRenderer: {
							tabs: [
								{
									tabRenderer: {
										content: {
											musicQueueRenderer: {
												content: {
													playlistPanelRenderer: {
														contents: [item],
														continuations: [{ nextContinuationData: { continuation: "TOKEN2" } }],
													},
												},
											},
										},
									},
								},
							],
						},
					},
				},
			},
		};
		expect(parseNextPanel(res)).toEqual({ items: [item], continuation: "TOKEN2" });
		expect(parseNextPanel({ data: res })).toEqual({ items: [item], continuation: "TOKEN2" });
		expect(queueItemVideoId(item)).toBe("abcdefghijk");
		expect(
			queueItemHitsVideoId(
				{
					playlistPanelVideoWrapperRenderer: {
						primaryRenderer: { playlistPanelVideoRenderer: { videoId: "mvxxxxxxxxxxx" } },
						counterpart: [{ counterpartRenderer: { playlistPanelVideoRenderer: { videoId: "abcdefghijk" } } }],
					},
				},
				"abcdefghijk",
			),
		).toBe(true);
	});
});

describe("remainingAfterIndex", () => {
	it("counts unplayed items after the current index", () => {
		expect(remainingAfterIndex(10, 6)).toBe(3);
		expect(remainingAfterIndex(10, 9)).toBe(0);
		expect(remainingAfterIndex(0, 0)).toBe(-1);
		expect(remainingAfterIndex(10, -1)).toBe(-1);
	});
});
