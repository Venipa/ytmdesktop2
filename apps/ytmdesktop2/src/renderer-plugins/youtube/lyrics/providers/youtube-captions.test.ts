import { describe, expect, it, vi } from "vitest";
import type { TrackSearchInfo, YouTubeCaptionTrack } from "../types";

vi.mock("../../lyrics.page", () => ({ lyricsPage: { request: vi.fn() } }));

import { normalizeCaptionCase, parseJson3Captions, pickCaptionTrack, searchYouTubeCaptions } from "./youtube-captions";

const info: TrackSearchInfo = {
	videoId: "vid1",
	title: "Song",
	artist: "Artist & Friend",
	durationSec: 200,
};

function track(partial: Partial<YouTubeCaptionTrack>): YouTubeCaptionTrack {
	return { languageCode: "en", url: "https://www.youtube.com/api/timedtext?v=vid1&lang=en", isAuto: false, name: "English", ...partial };
}

describe("pickCaptionTrack", () => {
	it("ignores auto-generated tracks entirely", () => {
		expect(pickCaptionTrack([track({ isAuto: true })])).toBeNull();
	});

	it("prefers the manual track in the video's spoken (ASR) language", () => {
		const picked = pickCaptionTrack([
			track({ languageCode: "en", name: "English" }),
			track({ languageCode: "ja", name: "Japanese" }),
			track({ languageCode: "ja-JP", isAuto: true, name: "Japanese (auto-generated)" }),
		]);
		expect(picked?.name).toBe("Japanese");
	});

	it("falls back to the first manual track", () => {
		expect(pickCaptionTrack([track({ isAuto: true, languageCode: "ko" }), track({ languageCode: "en" })])?.languageCode).toBe("en");
	});
});

describe("parseJson3Captions", () => {
	it("drops sound cues, strips note glyphs, keeps explicit durations", () => {
		const lines = parseJson3Captions({
			events: [
				{ tStartMs: 0, dDurationMs: 1000, segs: [{ utf8: "[Music]" }] },
				{ tStartMs: 1000, dDurationMs: 1500, segs: [{ utf8: "♪ Hello there ♪" }] },
				{ tStartMs: 1500, wWinId: 1 },
				{ tStartMs: 4000, dDurationMs: 2000, segs: [{ utf8: "second\nline" }] },
			],
		});
		expect(lines).toEqual([
			{ timeMs: 0, text: "", durationMs: 1000 },
			{ timeMs: 1000, text: "Hello there", durationMs: 1500 },
			{ timeMs: 4000, text: "second line", durationMs: 2000 },
		]);
	});

	it("turns per-segment offsets into word cues", () => {
		const [line] = parseJson3Captions({
			events: [{ tStartMs: 0, dDurationMs: 900, segs: [{ utf8: "one" }, { utf8: " two", tOffsetMs: 300 }, { utf8: " three", tOffsetMs: 600 }] }],
		});
		expect(line.text).toBe("one two three");
		expect(line.words).toEqual([
			{ timeMs: 0, text: "one", durationMs: 300 },
			{ timeMs: 300, text: " two", durationMs: 300 },
			{ timeMs: 600, text: " three", durationMs: 300 },
		]);
	});

	it("skips rolling-append events and tolerates junk", () => {
		expect(parseJson3Captions(null)).toEqual([]);
		expect(parseJson3Captions({ events: [{ tStartMs: 0, aAppend: 1, segs: [{ utf8: "x" }] }] })).toEqual([]);
	});
});

describe("normalizeCaptionCase", () => {
	it("sentence-cases all-caps tracks only", () => {
		const shouting = [{ timeMs: 0, text: "HELLO WORLD", durationMs: 1 }];
		expect(normalizeCaptionCase(shouting)[0].text).toBe("Hello world");
		const mixed = [{ timeMs: 0, text: "Hello WORLD", durationMs: 1 }];
		expect(normalizeCaptionCase(mixed)[0].text).toBe("Hello WORLD");
	});
});

describe("searchYouTubeCaptions", () => {
	const payload = {
		events: [
			{ tStartMs: 100, dDurationMs: 1000, segs: [{ utf8: "first" }] },
			{ tStartMs: 2000, dDurationMs: 1000, segs: [{ utf8: "second" }] },
		],
	};

	it("returns line-synced lyrics for the current video", async () => {
		const fetchJson = vi.fn(async (_url: string, _signal: AbortSignal) => payload);
		const result = await searchYouTubeCaptions(info, {
			loadTracks: async () => ({ videoId: "vid1", tracks: [track({})] }),
			fetchJson,
		});
		expect(result).toMatchObject({ provider: "youtube-captions", syncLevel: "line", hasWordSync: false, artists: ["Artist", "Friend"] });
		expect(result?.lines?.map((l) => l.text)).toEqual(["first", "second"]);
		expect(new URL(String(fetchJson.mock.calls[0]?.[0])).searchParams.get("fmt")).toBe("json3");
	});

	it("refuses captions that belong to a different video (prefetch / race)", async () => {
		const fetchJson = vi.fn(async () => payload);
		const result = await searchYouTubeCaptions(
			{ ...info, videoId: "other" },
			{ loadTracks: async () => ({ videoId: "vid1", tracks: [track({})] }), fetchJson },
		);
		expect(result).toBeNull();
		expect(fetchJson).not.toHaveBeenCalled();
	});

	it("treats an empty body / too few lines as a miss", async () => {
		const result = await searchYouTubeCaptions(info, {
			loadTracks: async () => ({ videoId: "vid1", tracks: [track({})] }),
			fetchJson: async () => null,
		});
		expect(result).toBeNull();
	});
});
