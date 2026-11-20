import { describe, expect, it } from "vitest";
import {
	continuationRetryAt,
	parseNextPanel,
	QUEUE_CONTINUE_RETRY_MS,
	queueItemHitsVideoId,
	queueItemVideoId,
	remainingAfterIndex,
} from "./queue-continue.parse";

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

describe("continuationRetryAt", () => {
	it("never retries a token that got an answer", () => {
		expect(continuationRetryAt("pending", 1000)).toBe(Number.POSITIVE_INFINITY);
	});

	it("retries a failed token after the backoff", () => {
		expect(continuationRetryAt("failed", 1000)).toBe(1000 + QUEUE_CONTINUE_RETRY_MS);
	});
});
