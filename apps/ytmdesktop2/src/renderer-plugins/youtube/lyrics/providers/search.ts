import type { LyricResult, LyricsMissReason, TrackSearchInfo } from "../types";
import { searchBetterLyrics } from "./better-lyrics";
import { CURRENT_VIDEO_ONLY_PROVIDERS, enabledLyricsProviderIds, type LyricsProviderId } from "./catalog";
import { searchLrcLib } from "./lrclib";
import { searchUnison } from "./unison";
import { searchYouTubeCaptions } from "./youtube-captions";

export interface LyricsSearchOptions {
	showEvenIfInexact: boolean;
	providers?: unknown;
	/** Better Lyrics `X-API-Key` (optional; empty = cache-only access). */
	betterLyricsApiKey?: string;
	/** Background "up next" lookup: providers that only see the current player video are skipped. */
	prefetch?: boolean;
	/** Keep trying later providers for word/syllable cues before settling for a line-synced hit. */
	preferWordSync?: boolean;
	signal?: AbortSignal;
}

export interface LyricsSearchOutcome {
	result: LyricResult | null;
	/** Set when Better Lyrics was tried and returned nothing; explains the empty state. */
	betterLyricsMiss?: LyricsMissReason;
	/** True when at least one enabled provider was skipped (prefetch) — the outcome is not final. */
	partial?: boolean;
}

async function runProvider(
	id: LyricsProviderId,
	info: TrackSearchInfo,
	options: LyricsSearchOptions,
	outcome: LyricsSearchOutcome,
): Promise<LyricResult | null> {
	switch (id) {
		case "better-lyrics":
			return searchBetterLyrics(info, {
				signal: options.signal,
				apiKey: options.betterLyricsApiKey,
				onMiss: (reason) => {
					outcome.betterLyricsMiss = reason;
				},
			});
		case "unison":
			return searchUnison(info, { signal: options.signal });
		case "lrclib":
			return searchLrcLib(info, {
				showEvenIfInexact: options.showEvenIfInexact,
				signal: options.signal,
			});
		case "youtube-captions":
			return searchYouTubeCaptions(info, { signal: options.signal });
		default:
			return null;
	}
}

function isTimed(result: LyricResult | null | undefined): boolean {
	return !!result?.lines?.length;
}

function isPlainOnly(result: LyricResult | null | undefined): boolean {
	return !!result?.plain?.trim() && !result?.lines?.length;
}

function isWordSynced(result: LyricResult | null | undefined): boolean {
	return isTimed(result) && (!!result?.hasWordSync || !!result?.lines?.some((l) => !!l.words?.length));
}

/**
 * Try enabled providers in user order.
 * Timed (line/syllable) wins immediately; plain is kept as fallback so later providers can still supply sync.
 * With `preferWordSync`, only word/syllable-synced results win immediately — a line-synced hit is kept as a
 * fallback while later providers get a chance to supply word cues.
 */
export async function searchLyricsDetailed(
	info: TrackSearchInfo,
	options: LyricsSearchOptions,
): Promise<LyricsSearchOutcome> {
	const order = enabledLyricsProviderIds(options.providers);
	const outcome: LyricsSearchOutcome = { result: null };
	let timedFallback: LyricResult | null = null;
	let plainFallback: LyricResult | null = null;
	for (const id of order) {
		if (options.prefetch && CURRENT_VIDEO_ONLY_PROVIDERS.has(id)) {
			outcome.partial = true;
			continue;
		}
		try {
			const result = await runProvider(id, info, options, outcome);
			if (isTimed(result)) {
				if (!options.preferWordSync || isWordSynced(result)) {
					outcome.result = result;
					return outcome;
				}
				if (!timedFallback) timedFallback = result;
				continue;
			}
			if (isPlainOnly(result) && !plainFallback) plainFallback = result;
		} catch {
			/* try next provider */
		}
	}
	outcome.result = timedFallback ?? plainFallback;
	return outcome;
}

/** Result-only convenience over {@link searchLyricsDetailed}. */
export async function searchLyrics(
	info: TrackSearchInfo,
	options: LyricsSearchOptions,
): Promise<LyricResult | null> {
	return (await searchLyricsDetailed(info, options)).result;
}
