import { parseLrc } from "../lrc";
import { artistMatchRatio } from "../match";
import type { LyricResult, TrackSearchInfo } from "../types";

const LRCLIB_BASE = "https://lrclib.net";
const ARTIST_THRESHOLD = 0.9;
const DURATION_TOLERANCE_SEC = 15;

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

async function searchApi(params: URLSearchParams, signal?: AbortSignal): Promise<LrcLibHit[]> {
	const url = `${LRCLIB_BASE}/api/search?${params.toString()}`;
	const response = await fetch(url, { signal });
	if (!response.ok) throw new Error(`LRCLib HTTP ${response.status}`);
	const data = (await response.json()) as unknown;
	if (!Array.isArray(data)) throw new Error("LRCLib: expected array");
	return data as LrcLibHit[];
}

function pickBest(hits: LrcLibHit[], info: TrackSearchInfo, allowInexact: boolean): { hit: LrcLibHit; inexact: boolean } | null {
	const scored = hits
		.map((hit) => {
			const artistRatio = artistMatchRatio(info.artist, hit.artistName);
			const durationDelta = Math.abs(hit.duration - info.durationSec);
			return { hit, artistRatio, durationDelta };
		})
		.filter((row) => row.artistRatio > ARTIST_THRESHOLD)
		.sort((a, b) => a.durationDelta - b.durationDelta);

	const exact = scored.find((row) => row.durationDelta <= DURATION_TOLERANCE_SEC);
	if (exact) return { hit: exact.hit, inexact: false };

	if (!allowInexact || !scored.length) return null;
	return { hit: scored[0].hit, inexact: true };
}

function toResult(hit: LrcLibHit, inexact: boolean): LyricResult | null {
	if (hit.instrumental) return null;
	const synced = hit.syncedLyrics?.trim();
	const plain = hit.plainLyrics?.trim();
	if (!synced && !plain) return null;
	return {
		title: hit.trackName,
		artists: hit.artistName.split(/[&,]/).map((s) => s.trim()).filter(Boolean),
		lines: synced ? parseLrc(synced) : undefined,
		plain: plain || undefined,
		inexact,
		provider: "lrclib",
	};
}

/** Fetch lyrics from LRCLib for the given track. */
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
