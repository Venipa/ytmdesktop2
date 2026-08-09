import { describe, expect, it } from "vitest";
import { buildApiThumbnailUrl, mapTrackToViewModel, withApiThumbnail } from "./map";

describe("embed map + api thumb", () => {
	it("maps videoId and prefers meta thumbnail", () => {
		const vm = mapTrackToViewModel({
			video: { videoId: "abc", title: "Song", author: "Artist" },
			meta: { thumbnail: "https://i.ytimg.com/vi/abc/hqdefault.jpg", duration: 120 },
		});
		expect(vm?.videoId).toBe("abc");
		expect(vm?.thumbnailUrl).toContain("ytimg.com");
	});

	it("builds local thumbnail url with id + token", () => {
		expect(buildApiThumbnailUrl("http://127.0.0.1:13091", { videoId: "abc", token: "t" })).toBe(
			"http://127.0.0.1:13091/track/thumbnail?id=abc&token=t",
		);
	});

	it("rewrites view-model thumb to local api", () => {
		const vm = mapTrackToViewModel({
			video: { videoId: "abc", title: "Song", author: "A" },
			meta: { thumbnail: "https://i.ytimg.com/vi/abc/hqdefault.jpg" },
		});
		const next = withApiThumbnail(vm, "http://127.0.0.1:13091", null);
		expect(next?.thumbnailUrl).toBe("http://127.0.0.1:13091/track/thumbnail?id=abc");
	});
});
