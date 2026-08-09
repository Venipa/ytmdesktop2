import { createFetch } from "@better-fetch/fetch";
import { parseTtml, ttmlHasWordSync } from "../ttml";
import type { LyricResult, TrackSearchInfo } from "../types";

/** Public Better Lyrics API — https://lyrics-api-docs.boidu.dev */
const blFetch = createFetch({
	baseURL: "https://lyrics-api.boidu.dev",
	throw: false as const,
	headers: {
		"User-Agent": "YTMDesktop2 (https://youtube-music.app)",
	},
});

export interface BetterLyricsSearchOptions {
	signal?: AbortSignal;
}

interface BetterLyricsResponse {
	ttml?: string;
	score?: number;
	error?: string;
	message?: string;
}

/**
 * Fetch syllable/word-synced TTML from Better Lyrics public API.
 * Cache hits are free; uncached misses may 401 without an API key — caller should fall back.
 */
export async function searchBetterLyrics(
	info: TrackSearchInfo,
	options: BetterLyricsSearchOptions = {},
): Promise<LyricResult | null> {
	const query: Record<string, string | number> = {
		s: info.title,
		a: info.artist,
	};
	if (info.album) query.al = info.album;
	if (info.durationSec > 0) query.d = Math.round(info.durationSec);
	if (info.videoId) query.videoId = info.videoId;

	const { data, error } = await blFetch<BetterLyricsResponse>("/getLyrics", {
		query,
		...(options.signal ? { signal: options.signal } : {}),
	});

	if (error) {
		// 401 = cache miss without key; 404 = no lyrics — soft miss for fallback.
		if (error.status === 401 || error.status === 404 || error.status === 429) return null;
		throw new Error(`Better Lyrics HTTP ${error.status}`);
	}

	const ttml = data?.ttml?.trim();
	if (!ttml) return null;

	const lines = parseTtml(ttml);
	if (!lines.length) return null;
	const hasWordSync = ttmlHasWordSync(ttml) || lines.some((l) => !!l.words?.length);

	return {
		title: info.title,
		artists: info.artist.split(/[&,]/).map((s) => s.trim()).filter(Boolean),
		lines,
		inexact: false,
		provider: "better-lyrics",
		hasWordSync,
		syncLevel: hasWordSync ? "syllable" : "line",
	};
}
