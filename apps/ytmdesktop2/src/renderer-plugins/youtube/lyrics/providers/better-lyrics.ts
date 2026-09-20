import { createFetch } from "@better-fetch/fetch";
import { parseTtml, ttmlHasWordSync } from "../ttml";
import type { LyricResult, LyricsMissReason, TrackSearchInfo } from "../types";

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
	/** Optional `X-API-Key`; unlocks cache misses and rate-limit bypass. */
	apiKey?: string;
	/** Called on a soft miss (null result) with why, so the UI can hint at a fix. */
	onMiss?: (reason: LyricsMissReason) => void;
}

interface BetterLyricsResponse {
	ttml?: string;
	score?: number;
	error?: string;
	message?: string;
}

/**
 * Fetch syllable/word-synced TTML from Better Lyrics public API.
 * Cache hits are free; uncached misses 401 without an API key — caller should fall back.
 * With a key, 401 means the key was rejected (`X-Auth-Mode: invalid`).
 */
export async function searchBetterLyrics(
	info: TrackSearchInfo,
	options: BetterLyricsSearchOptions = {},
): Promise<LyricResult | null> {
	const query: Record<string, string | number> = {
		s: info.title,
		a: info.artist,
	};
	if (info.durationSec > 0) query.d = Math.round(info.durationSec);
	if (info.videoId) query.videoId = info.videoId;

	const apiKey = options.apiKey?.trim();
	const request = (q: Record<string, string | number>) =>
		blFetch<BetterLyricsResponse>("/getLyrics", {
			query: q,
			...(apiKey ? { headers: { "X-API-Key": apiKey } } : {}),
			...(options.signal ? { signal: options.signal } : {}),
		});

	// The album is part of the cache key. YTM's album string (e.g. "÷ (Deluxe)") often differs
	// from what the extension cached the song under, so a keyless 401 with the album set is
	// retried without it before we call the song uncached.
	let { data, error } = await (info.album ? request({ ...query, al: info.album }) : request(query));
	if (error?.status === 401 && !apiKey && info.album) {
		({ data, error } = await request(query));
	}

	if (error) {
		// 401 = cache miss without key (or rejected key); 404 = no lyrics; 429 = rate limited.
		// All are soft misses so the next provider gets a turn.
		if (error.status === 401) {
			options.onMiss?.(apiKey ? "invalid-key" : "uncached");
			return null;
		}
		if (error.status === 404) {
			options.onMiss?.("not-found");
			return null;
		}
		if (error.status === 429) {
			options.onMiss?.("rate-limited");
			return null;
		}
		throw new Error(`Better Lyrics HTTP ${error.status}`);
	}

	const ttml = data?.ttml?.trim();
	if (!ttml) {
		options.onMiss?.("not-found");
		return null;
	}

	const lines = parseTtml(ttml);
	if (!lines.length) {
		options.onMiss?.("not-found");
		return null;
	}
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
