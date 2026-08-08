import { describe, expect, test } from "vitest";
import { YtmdLink } from "./ytmdProtocol";

describe("YtmdLink.fromHttps", () => {
	test("converts music / youtube / youtu.be hosts", () => {
		expect(YtmdLink.fromHttps("https://music.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
			"ytmd://music.youtube.com/watch?v=dQw4w9WgXcQ",
		);
		expect(YtmdLink.fromHttps("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
			"ytmd://www.youtube.com/watch?v=dQw4w9WgXcQ",
		);
		expect(YtmdLink.fromHttps("https://youtu.be/dQw4w9WgXcQ")).toBe("ytmd://youtu.be/dQw4w9WgXcQ");
		expect(YtmdLink.fromHttps("https://evil.example/watch?v=dQw4w9WgXcQ")).toBeNull();
	});
});

describe("YtmdLink.resolve", () => {
	test("watch hosts", () => {
		expect(YtmdLink.resolve("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual({
			type: "watch",
			videoId: "dQw4w9WgXcQ",
		});
		expect(YtmdLink.resolve("ytmd://youtu.be/dQw4w9WgXcQ")).toEqual({
			type: "watch",
			videoId: "dQw4w9WgXcQ",
		});
		expect(YtmdLink.resolve("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toEqual({
			type: "watch",
			videoId: "dQw4w9WgXcQ",
		});
	});

	test("strips radio list on watch", () => {
		expect(YtmdLink.resolve("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=RDAMVM12345678901")).toEqual({
			type: "watch",
			videoId: "dQw4w9WgXcQ",
		});
		expect(YtmdLink.resolve("ytmd://watch/dQw4w9WgXcQ/RDAMVM12345678901")).toEqual({
			type: "watch",
			videoId: "dQw4w9WgXcQ",
		});
	});

	test("keeps album list on watch", () => {
		expect(
			YtmdLink.resolve("https://youtu.be/dQw4w9WgXcQ?list=OLAK5uy_abcdefghijklmnopqrs"),
		).toEqual({
			type: "watch",
			videoId: "dQw4w9WgXcQ",
			playlistId: "OLAK5uy_abcdefghijklmnopqrs",
		});
	});

	test("playlist and channel", () => {
		expect(YtmdLink.resolve("ytmd://playlist/PLabcdefghijklmnopqrstuv/play")).toEqual({
			type: "playlist",
			playlistId: "PLabcdefghijklmnopqrstuv",
			play: true,
		});
		expect(YtmdLink.resolve("ytmd://www.youtube.com/channel/UCabcdefghijklmnopqrstuv")).toEqual({
			type: "channel",
			channelId: "UCabcdefghijklmnopqrstuv",
		});
		expect(YtmdLink.resolve("ytmd://music.youtube.com/%40Some_Handle")).toEqual({
			type: "channel",
			handle: "Some_Handle",
		});
	});

	test("toYtmd compact rewrite", () => {
		expect(YtmdLink.toYtmd("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("ytmd://watch/dQw4w9WgXcQ");
		expect(YtmdLink.toYtmd("https://youtu.be/dQw4w9WgXcQ")).toBe("ytmd://watch/dQw4w9WgXcQ");
		expect(YtmdLink.toYtmd("https://example.com/watch?v=dQw4w9WgXcQ")).toBeNull();
		// YTM share panel URL includes tracking `si=`
		expect(YtmdLink.toYtmd("https://music.youtube.com/watch?v=i5WFoQjPAss&si=bCGoYN4b-_wCsQeQ")).toBe(
			"ytmd://watch/i5WFoQjPAss",
		);
	});

	test("rejects junk", () => {
		expect(YtmdLink.resolve("ytmd://watch/short")).toBeNull();
		expect(YtmdLink.resolve("https://example.com/watch?v=dQw4w9WgXcQ")).toBeNull();
		expect(YtmdLink.resolve("not-a-url")).toBeNull();
	});
});
