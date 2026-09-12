import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LyricResult, TrackSearchInfo } from "../types";
import { enabledLyricsProviderIds, LYRICS_PROVIDER_META, moveLyricsProvider, normalizeLyricsProviders, setLyricsProviderEnabled } from "./catalog";

vi.mock("./better-lyrics", () => ({ searchBetterLyrics: vi.fn() }));
vi.mock("./unison", () => ({ searchUnison: vi.fn() }));
vi.mock("./lrclib", () => ({ searchLrcLib: vi.fn() }));
vi.mock("./youtube-captions", () => ({ searchYouTubeCaptions: vi.fn() }));

import { searchBetterLyrics } from "./better-lyrics";
import { searchLrcLib } from "./lrclib";
import { searchLyrics, searchLyricsDetailed } from "./search";
import { searchUnison } from "./unison";
import { searchYouTubeCaptions } from "./youtube-captions";

const info: TrackSearchInfo = {
	videoId: "dQw4w9WgXcQ",
	title: "Never Gonna Give You Up",
	artist: "Rick Astley",
	durationSec: 213,
};

function hit(provider: LyricResult["provider"]): LyricResult {
	return {
		title: info.title,
		artists: [info.artist],
		lines: [{ timeMs: 0, text: "hi", durationMs: 1000 }],
		inexact: false,
		provider,
		hasWordSync: false,
		syncLevel: "line",
	};
}

describe("catalog", () => {
	it("normalizes order, legacy strings, and enabled flags", () => {
		expect(normalizeLyricsProviders(["lrclib", "nope"])).toEqual([
			{ id: "lrclib", enabled: true },
			{ id: "better-lyrics", enabled: true },
			{ id: "unison", enabled: true },
			{ id: "youtube-captions", enabled: true },
		]);
		expect(
			enabledLyricsProviderIds([
				{ id: "better-lyrics", enabled: false },
				{ id: "unison", enabled: true },
			]),
		).toEqual(["unison", "lrclib", "youtube-captions"]);
	});

	it("supports Providers card reorder + toggle", () => {
		const base = normalizeLyricsProviders(undefined);
		const moved = moveLyricsProvider(base, 0, 2);
		expect(moved?.map((e) => e.id)).toEqual(["unison", "lrclib", "better-lyrics", "youtube-captions"]);
		expect(moveLyricsProvider(base, 0, 0)).toBeNull();

		const toggled = setLyricsProviderEnabled(base, "lrclib", false);
		expect(toggled.find((e) => e.id === "lrclib")?.enabled).toBe(false);
		expect(enabledLyricsProviderIds(toggled)).toEqual(["better-lyrics", "unison", "youtube-captions"]);

		for (const id of ["better-lyrics", "unison", "lrclib", "youtube-captions"] as const) {
			expect(LYRICS_PROVIDER_META[id].href).toMatch(/^https:\/\//);
			expect(LYRICS_PROVIDER_META[id].label.length).toBeGreaterThan(0);
		}
	});
});

describe("searchLyrics", () => {
	beforeEach(() => {
		vi.mocked(searchBetterLyrics).mockReset();
		vi.mocked(searchUnison).mockReset();
		vi.mocked(searchLrcLib).mockReset();
	});

	it("stops on first timed hit in priority order", async () => {
		vi.mocked(searchBetterLyrics).mockResolvedValue(hit("better-lyrics"));
		vi.mocked(searchUnison).mockResolvedValue(hit("unison"));

		const result = await searchLyrics(info, {
			showEvenIfInexact: true,
			providers: [
				{ id: "better-lyrics", enabled: false },
				{ id: "unison", enabled: true },
				{ id: "lrclib", enabled: true },
			],
		});
		expect(result?.provider).toBe("unison");
		expect(searchBetterLyrics).not.toHaveBeenCalled();
		expect(searchLrcLib).not.toHaveBeenCalled();
	});

	it("skips plain until timed fails, then returns plain", async () => {
		vi.mocked(searchBetterLyrics).mockResolvedValue({
			title: info.title,
			artists: [info.artist],
			plain: "unsynced",
			inexact: false,
			provider: "better-lyrics",
			syncLevel: "plain",
		});
		vi.mocked(searchUnison).mockRejectedValue(new Error("boom"));
		vi.mocked(searchLrcLib).mockResolvedValue(null);

		const result = await searchLyrics(info, { showEvenIfInexact: true });
		expect(result).toMatchObject({ provider: "better-lyrics", plain: "unsynced" });
		expect(searchUnison).toHaveBeenCalledOnce();
		expect(searchLrcLib).toHaveBeenCalledOnce();
	});
});

describe("searchLyricsDetailed", () => {
	beforeEach(() => {
		vi.mocked(searchBetterLyrics).mockReset();
		vi.mocked(searchUnison).mockReset();
		vi.mocked(searchLrcLib).mockReset();
	});

	it("forwards the API key and surfaces the Better Lyrics miss reason when nothing is found", async () => {
		vi.mocked(searchBetterLyrics).mockImplementation(async (_info, options) => {
			options?.onMiss?.("uncached");
			return null;
		});
		vi.mocked(searchUnison).mockResolvedValue(null);
		vi.mocked(searchLrcLib).mockResolvedValue(null);

		const outcome = await searchLyricsDetailed(info, { showEvenIfInexact: true, betterLyricsApiKey: "k" });
		expect(outcome).toEqual({ result: null, betterLyricsMiss: "uncached" });
		expect(vi.mocked(searchBetterLyrics).mock.calls[0]?.[1]).toMatchObject({ apiKey: "k" });
	});

	it("keeps the miss reason even when a later provider wins", async () => {
		vi.mocked(searchBetterLyrics).mockImplementation(async (_info, options) => {
			options?.onMiss?.("uncached");
			return null;
		});
		vi.mocked(searchUnison).mockResolvedValue(hit("unison"));

		const outcome = await searchLyricsDetailed(info, { showEvenIfInexact: true });
		expect(outcome.result?.provider).toBe("unison");
		expect(outcome.betterLyricsMiss).toBe("uncached");
	});
});

describe("searchLyricsDetailed prefetch", () => {
	beforeEach(() => {
		vi.mocked(searchBetterLyrics).mockReset();
		vi.mocked(searchUnison).mockReset();
		vi.mocked(searchLrcLib).mockReset();
		vi.mocked(searchYouTubeCaptions).mockReset();
	});

	it("skips current-video-only providers and flags the outcome as partial", async () => {
		vi.mocked(searchBetterLyrics).mockResolvedValue(null);
		vi.mocked(searchUnison).mockResolvedValue(null);
		vi.mocked(searchLrcLib).mockResolvedValue(null);
		vi.mocked(searchYouTubeCaptions).mockResolvedValue(hit("youtube-captions"));

		const outcome = await searchLyricsDetailed(info, { showEvenIfInexact: true, prefetch: true });
		expect(outcome).toMatchObject({ result: null, partial: true });
		expect(searchYouTubeCaptions).not.toHaveBeenCalled();

		const full = await searchLyricsDetailed(info, { showEvenIfInexact: true });
		expect(full.result?.provider).toBe("youtube-captions");
		expect(full.partial).toBeUndefined();
	});
});

describe("searchLyricsDetailed preferWordSync", () => {
	beforeEach(() => {
		vi.mocked(searchBetterLyrics).mockReset();
		vi.mocked(searchUnison).mockReset();
		vi.mocked(searchLrcLib).mockReset();
		vi.mocked(searchYouTubeCaptions).mockReset();
	});

	const wordHit = (): LyricResult => ({ ...hit("unison"), hasWordSync: true, syncLevel: "syllable" });
	const order = [
		{ id: "lrclib", enabled: true },
		{ id: "unison", enabled: true },
		{ id: "better-lyrics", enabled: false },
		{ id: "youtube-captions", enabled: false },
	];

	it("keeps searching past a line-synced hit for word sync, then falls back to it", async () => {
		vi.mocked(searchLrcLib).mockResolvedValue(hit("lrclib"));
		vi.mocked(searchUnison).mockResolvedValue(wordHit());

		const preferred = await searchLyricsDetailed(info, { showEvenIfInexact: true, providers: order, preferWordSync: true });
		expect(preferred.result?.provider).toBe("unison");

		vi.mocked(searchUnison).mockResolvedValue(null);
		const fallback = await searchLyricsDetailed(info, { showEvenIfInexact: true, providers: order, preferWordSync: true });
		expect(fallback.result?.provider).toBe("lrclib");
	});

	it("stops at the first timed hit when disabled", async () => {
		vi.mocked(searchLrcLib).mockResolvedValue(hit("lrclib"));
		vi.mocked(searchUnison).mockResolvedValue(wordHit());

		const outcome = await searchLyricsDetailed(info, { showEvenIfInexact: true, providers: order, preferWordSync: false });
		expect(outcome.result?.provider).toBe("lrclib");
		expect(searchUnison).not.toHaveBeenCalled();
	});
});
