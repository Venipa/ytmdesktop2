import { createFetch } from "@better-fetch/fetch";
import { parseLrc } from "../lrc";
import { artistMatchRatio } from "../match";
import type { LyricResult, TrackSearchInfo } from "../types";

const lrclibFetch = createFetch({
	baseURL: "https://lrclib.net",
	throw: false as const,
	headers: {
		"User-Agent": "YTMDesktop2 (https://youtube-music.app)",
	},
});

const ARTIST_THRESHOLD = 0.9;
export const DURATION_TOLERANCE_SEC = 15;

interface LrcLibHit {
	id: number;
	trackName: string;
	artistName: string;
	albumName: string;
	duration: number;
	instrumental: boolean;
	plainLyrics: string | null;
	syncedLyrics: string | null;
}

export interface LrcLibSearchOptions {
	showEvenIfInexact: boolean;
	signal?: AbortSignal;
}

export interface RankedLrcLibHit {
	hit: LrcLibHit;
	artistRatio: number;
	durationDelta: number;
}

async function searchApi(params: URLSearchParams, signal?: AbortSignal): Promise<LrcLibHit[]> {
	const { data, error } = await lrclibFetch<LrcLibHit[]>("/api/search", {
		query: Object.fromEntries(params),
		...(signal ? { signal } : {}),
	});
	if (error) throw new Error(`LRCLib HTTP ${error.status}`);
	if (!Array.isArray(data)) throw new Error("LRCLib: expected array");
	return data;
}

function hasSynced(hit: LrcLibHit): boolean {
	return !!hit.syncedLyrics?.trim();
}

/**
 * Rank: duration within tolerance first, then synced before plain-only, then closest duration, then artist score.
 * Timed lines are the whole point of the provider, so a synced hit a few seconds off beats a plain-only exact match.
 */
export function rankLrcLibHits(hits: LrcLibHit[], info: TrackSearchInfo): RankedLrcLibHit[] {
	return hits
		.map((hit) => {
			const artistRatio = artistMatchRatio(info.artist, hit.artistName);
			const durationDelta = Math.abs(hit.duration - info.durationSec);
			return { hit, artistRatio, durationDelta };
		})
		.filter((row) => row.artistRatio > ARTIST_THRESHOLD)
		.sort((a, b) => {
			const aExact = a.durationDelta <= DURATION_TOLERANCE_SEC ? 0 : 1;
			const bExact = b.durationDelta <= DURATION_TOLERANCE_SEC ? 0 : 1;
			if (aExact !== bExact) return aExact - bExact;
			const aSynced = hasSynced(a.hit) ? 0 : 1;
			const bSynced = hasSynced(b.hit) ? 0 : 1;
			if (aSynced !== bSynced) return aSynced - bSynced;
			if (a.durationDelta !== b.durationDelta) return a.durationDelta - b.durationDelta;
			return b.artistRatio - a.artistRatio;
		});
}

/**
 * Alternate spellings of a YTM title worth querying when the full title finds no synced hit.
 * YTM (esp. JP/KR releases) often titles tracks `原題 - romaji (english)`; LRCLib entries use any one of the parts.
 */
export function lrcLibTitleVariants(title: string): string[] {
	const out: string[] = [];
	const push = (s: string) => {
		const t = s.replace(/\s+/g, " ").trim();
		if (t && !out.includes(t)) out.push(t);
	};
	const stripSuffix = (s: string) => s.replace(/\s*[([][^)\]]*[)\]]\s*$/g, "").replace(/\s*(?:feat|ft)\.?\s.*$/i, "");

	push(title);
	const parts = title.split(/\s+[-–—/|]\s+/);
	for (const part of parts) {
		push(part);
		push(stripSuffix(part));
	}
	push(stripSuffix(title));
	return out.slice(0, 5);
}

export function pickBest(
	hits: LrcLibHit[],
	info: TrackSearchInfo,
	allowInexact: boolean,
): { hit: LrcLibHit; inexact: boolean } | null {
	const ranked = rankLrcLibHits(hits, info);
	const best = ranked[0];
	if (!best) return null;
	if (best.durationDelta <= DURATION_TOLERANCE_SEC) {
		return { hit: best.hit, inexact: false };
	}
	if (!allowInexact) return null;
	return { hit: best.hit, inexact: true };
}

function artistsFromHit(artistName: string): string[] {
	return artistName.split(/[&,]/).map((s) => s.trim()).filter(Boolean);
}

function toResult(hit: LrcLibHit, inexact: boolean): LyricResult | null {
	if (hit.instrumental) return null;
	const synced = hit.syncedLyrics?.trim();
	const plain = hit.plainLyrics?.trim();
	if (!synced && !plain) return null;
	const lines = synced ? parseLrc(synced) : undefined;
	// LRCLib is usually plain `[mm:ss.xx]` LRC, but enhanced `<mm:ss.xx>` word tags do show up — honor them.
	const hasWordSync = !!lines?.some((l) => !!l.words?.length);
	return {
		title: hit.trackName,
		artists: artistsFromHit(hit.artistName),
		...(lines ? { lines } : {}),
		...(plain ? { plain } : {}),
		inexact,
		provider: "lrclib",
		hasWordSync,
		syncLevel: hasWordSync ? "word" : synced ? "line" : "plain",
	};
}

/** True when `hits` already contain a synced, artist-matched entry within duration tolerance — no need to keep querying. */
function hasGoodSyncedHit(hits: LrcLibHit[], info: TrackSearchInfo): boolean {
	const best = rankLrcLibHits(hits, info)[0];
	return !!best && best.durationDelta <= DURATION_TOLERANCE_SEC && hasSynced(best.hit);
}

/**
 * Fetch line-synced / plain lyrics from LRCLib.
 * Queries the full title first, then title variants until a synced in-tolerance hit shows up; hits are pooled
 * (deduped by id) so a plain-only exact match never hides a synced entry filed under another spelling.
 */
export async function searchLrcLib(info: TrackSearchInfo, options: LrcLibSearchOptions): Promise<LyricResult | null> {
	const pooled = new Map<number, LrcLibHit>();
	const collect = (hits: LrcLibHit[]) => {
		for (const hit of hits) if (!pooled.has(hit.id)) pooled.set(hit.id, hit);
	};

	for (const title of lrcLibTitleVariants(info.title)) {
		const params = new URLSearchParams({ artist_name: info.artist, track_name: title });
		if (info.album && title === info.title) params.set("album_name", info.album);
		collect(await searchApi(params, options.signal));
		if (hasGoodSyncedHit([...pooled.values()], info)) break;
	}

	if (!pooled.size && options.showEvenIfInexact) {
		collect(await searchApi(new URLSearchParams({ q: info.title }), options.signal));
	}

	const picked = pickBest([...pooled.values()], info, options.showEvenIfInexact);
	if (!picked) return null;
	return toResult(picked.hit, picked.inexact);
}
