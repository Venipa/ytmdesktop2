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

/** Rank by duration match, then artist score. Line-synced only (no word sync). */
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
			if (a.durationDelta !== b.durationDelta) return a.durationDelta - b.durationDelta;
			return b.artistRatio - a.artistRatio;
		});
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
	return {
		title: hit.trackName,
		artists: artistsFromHit(hit.artistName),
		...(synced ? { lines: parseLrc(synced) } : {}),
		...(plain ? { plain } : {}),
		inexact,
		provider: "lrclib",
		hasWordSync: false,
		syncLevel: synced ? "line" : "plain",
	};
}

/** Fetch line-synced / plain lyrics from LRCLib. */
export async function searchLrcLib(info: TrackSearchInfo, options: LrcLibSearchOptions): Promise<LyricResult | null> {
	const params = new URLSearchParams({
		artist_name: info.artist,
		track_name: info.title,
	});
	if (info.album) params.set("album_name", info.album);

	let hits = await searchApi(params, options.signal);

	if (!hits.length && options.showEvenIfInexact) {
		hits = await searchApi(new URLSearchParams({ q: info.title }), options.signal);
	}

	const picked = pickBest(hits, info, options.showEvenIfInexact);
	if (!picked) return null;
	return toResult(picked.hit, picked.inexact);
}
