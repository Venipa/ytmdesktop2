import { enabledLyricsProviderIds, type LyricsProviderId } from "./catalog";
import { searchBetterLyrics } from "./better-lyrics";
import { searchLrcLib } from "./lrclib";
import { searchUnison } from "./unison";
import type { LyricResult, TrackSearchInfo } from "../types";

export interface LyricsSearchOptions {
	showEvenIfInexact: boolean;
	providers?: unknown;
	signal?: AbortSignal;
}

async function runProvider(
	id: LyricsProviderId,
	info: TrackSearchInfo,
	options: LyricsSearchOptions,
): Promise<LyricResult | null> {
	switch (id) {
		case "better-lyrics":
			return searchBetterLyrics(info, { signal: options.signal });
		case "unison":
			return searchUnison(info, { signal: options.signal });
		case "lrclib":
			return searchLrcLib(info, {
				showEvenIfInexact: options.showEvenIfInexact,
				signal: options.signal,
			});
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

/**
 * Try enabled providers in user order.
 * Timed (line/syllable) wins immediately; plain is kept as fallback so later providers can still supply sync.
 */
export async function searchLyrics(
	info: TrackSearchInfo,
	options: LyricsSearchOptions,
): Promise<LyricResult | null> {
	const order = enabledLyricsProviderIds(options.providers);
	let plainFallback: LyricResult | null = null;
	for (const id of order) {
		try {
			const result = await runProvider(id, info, options);
			if (isTimed(result)) return result;
			if (isPlainOnly(result) && !plainFallback) plainFallback = result;
		} catch {
			/* try next provider */
		}
	}
	return plainFallback;
}
