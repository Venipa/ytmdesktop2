import { describe, expect, it } from "vitest";
import { queueListSignature, summarizeQueueItem } from "./api-controls.cmds";

describe("summarizeQueueItem", () => {
	it("reads title artist thumbnail from playlistPanelVideoRenderer", () => {
		const item = {
			playlistPanelVideoRenderer: {
				videoId: "abcdefghijk",
				title: { runs: [{ text: "Song" }] },
				shortBylineText: { runs: [{ text: "Artist" }] },
				thumbnail: { thumbnails: [{ url: "https://i.ytimg.com/a.jpg" }, { url: "https://i.ytimg.com/b.jpg" }] },
				lengthText: { simpleText: "3:21" },
			},
		};
		expect(summarizeQueueItem(item, 3)).toEqual({
			index: 3,
			videoId: "abcdefghijk",
			title: "Song",
			artist: "Artist",
			thumbnail: "https://i.ytimg.com/b.jpg",
			durationSec: 201,
		});
	});

	it("reads nested musicThumbnailRenderer thumbs", () => {
		const item = {
			playlistPanelVideoRenderer: {
				videoId: "abcdefghijk",
				thumbnailRenderer: {
					musicThumbnailRenderer: {
						thumbnail: { thumbnails: [{ url: "//yt3.ggpht.com/a.jpg" }] },
					},
				},
			},
		};
		expect(summarizeQueueItem(item, 0).thumbnail).toBe("//yt3.ggpht.com/a.jpg");
	});

	it("sets songId from ATV counterpart when primary is a music video", () => {
		const item = {
			playlistPanelVideoWrapperRenderer: {
				primaryRenderer: {
					playlistPanelVideoRenderer: {
						videoId: "videovideov",
						navigationEndpoint: {
							watchEndpoint: {
								videoId: "videovideov",
								watchEndpointMusicSupportedConfigs: {
									watchEndpointMusicConfig: { musicVideoType: "MUSIC_VIDEO_TYPE_OMV" },
								},
							},
						},
					},
				},
				counterpart: [
					{
						counterpartRenderer: {
							playlistPanelVideoRenderer: {
								videoId: "songsongsong",
								navigationEndpoint: {
									watchEndpoint: {
										videoId: "songsongsong",
										watchEndpointMusicSupportedConfigs: {
											watchEndpointMusicConfig: { musicVideoType: "MUSIC_VIDEO_TYPE_ATV" },
										},
									},
								},
							},
						},
					},
				],
			},
		};
		expect(summarizeQueueItem(item, 0)).toMatchObject({
			videoId: "videovideov",
			songId: "songsongsong",
		});
	});

	it("queueListSignature changes when first/last/context change", () => {
		const a = { playlistPanelVideoRenderer: { videoId: "aaaaaaaaaaa" } };
		const b = { playlistPanelVideoRenderer: { videoId: "bbbbbbbbbbb" } };
		expect(queueListSignature([a], "p1")).not.toBe(queueListSignature([b], "p1"));
		expect(queueListSignature([a], "p1")).not.toBe(queueListSignature([a], "p2"));
	});
});
