import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LyricResult, TrackSearchInfo } from "../types";
import { enabledLyricsProviderIds, LYRICS_PROVIDER_META, moveLyricsProvider, normalizeLyricsProviders, setLyricsProviderEnabled } from "./catalog";

vi.mock("./better-lyrics", () => ({ searchBetterLyrics: vi.fn() }));
vi.mock("./unison", () => ({ searchUnison: vi.fn() }));
vi.mock("./lrclib", () => ({ searchLrcLib: vi.fn() }));

import { searchBetterLyrics } from "./better-lyrics";
import { searchLrcLib } from "./lrclib";
import { searchUnison } from "./unison";
import { searchLyrics } from "./search";

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
		]);
		expect(
			enabledLyricsProviderIds([
				{ id: "better-lyrics", enabled: false },
				{ id: "unison", enabled: true },
			]),
		).toEqual(["unison", "lrclib"]);
	});

	it("supports Providers card reorder + toggle", () => {
		const base = normalizeLyricsProviders(undefined);
		const moved = moveLyricsProvider(base, 0, 2);
		expect(moved?.map((e) => e.id)).toEqual(["unison", "lrclib", "better-lyrics"]);
		expect(moveLyricsProvider(base, 0, 0)).toBeNull();

		const toggled = setLyricsProviderEnabled(base, "lrclib", false);
		expect(toggled.find((e) => e.id === "lrclib")?.enabled).toBe(false);
		expect(enabledLyricsProviderIds(toggled)).toEqual(["better-lyrics", "unison"]);

		for (const id of ["better-lyrics", "unison", "lrclib"] as const) {
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
