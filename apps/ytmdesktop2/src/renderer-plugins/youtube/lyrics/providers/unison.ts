import { createFetch } from "@better-fetch/fetch";
import { parseLrc } from "../lrc";
import { artistMatchRatio, stringSimilarity } from "../match";
import { parseTtml, ttmlHasWordSync } from "../ttml";
import type { LyricResult, TrackSearchInfo } from "../types";

/** Unison community lyrics — https://github.com/better-lyrics/unison */
const unisonFetch = createFetch({
	baseURL: "https://unison.boidu.dev",
	throw: false as const,
	headers: {
		"User-Agent": "YTMDesktop2 (https://youtube-music.app)",
	},
});

const TITLE_THRESHOLD = 0.85;
const ARTIST_THRESHOLD = 0.9;
const DURATION_TOLERANCE_SEC = 15;

export interface UnisonSearchOptions {
	signal?: AbortSignal;
}

interface UnisonHit {
	id: number;
	videoId?: string;
	song: string;
	artist: string;
	duration: number;
	lyrics?: string;
	format: "ttml" | "lrc" | "plain";
	syncType: "richsync" | "linesync" | "plain";
	effectiveScore?: number;
	matchScore?: number;
}

interface UnisonEnvelope {
	success?: boolean;
	data?: UnisonHit;
}

interface UnisonSearchEnvelope {
	success?: boolean;
	data?: UnisonHit[];
}

function softMiss(status?: number): boolean {
	return status === 404 || status === 401 || status === 429;
}

function toResult(hit: UnisonHit, info: TrackSearchInfo, inexact: boolean): LyricResult | null {
	const lyrics = hit.lyrics?.trim();
	if (!lyrics || !hit.format) return null;

	const artists = (hit.artist || info.artist)
		.split(/[&,]/)
		.map((s) => s.trim())
		.filter(Boolean);
	const title = hit.song || info.title;
	const hasWords = (lines: { words?: unknown[] }[]) => lines.some((l) => !!l.words?.length);

	if (hit.format === "ttml") {
		const lines = parseTtml(lyrics);
		if (!lines.length) return null;
		const wordy = ttmlHasWordSync(lyrics) || hasWords(lines);
		return {
			title,
			artists,
			lines,
			inexact,
			provider: "unison",
			hasWordSync: wordy,
			syncLevel: hit.syncType === "richsync" || wordy ? "syllable" : "line",
		};
	}

	if (hit.format === "lrc") {
		const lines = parseLrc(lyrics);
		if (!lines.length) return null;
		const wordy = hasWords(lines);
		return {
			title,
			artists,
			lines,
			inexact,
			provider: "unison",
			hasWordSync: wordy,
			syncLevel: wordy ? "word" : "line",
		};
	}

	return {
		title,
		artists,
		plain: lyrics,
		inexact,
		provider: "unison",
		hasWordSync: false,
		syncLevel: "plain",
	};
}

function isAcceptableHit(hit: UnisonHit, info: TrackSearchInfo): boolean {
	if (stringSimilarity(info.title, hit.song || "") < TITLE_THRESHOLD) return false;
	if (artistMatchRatio(info.artist, hit.artist || "") < ARTIST_THRESHOLD) return false;
	if (info.durationSec > 0 && hit.duration > 0) {
		if (Math.abs(hit.duration - Math.round(info.durationSec)) > DURATION_TOLERANCE_SEC) return false;
	}
	return true;
}

async function fetchLyricsHit(
	query: Record<string, string | number>,
	signal?: AbortSignal,
): Promise<UnisonHit | null> {
	const { data, error } = await unisonFetch<UnisonEnvelope>("/lyrics", {
		query,
		...(signal ? { signal } : {}),
	});
	if (error) {
		if (softMiss(error.status)) return null;
		throw new Error(`Unison HTTP ${error.status}`);
	}
	const hit = data?.data;
	return hit?.lyrics?.trim() && hit.format ? hit : null;
}

async function fetchHitByRef(
	ref: { videoId?: string; id?: number },
	signal?: AbortSignal,
): Promise<UnisonHit | null> {
	if (ref.videoId) {
		const byVideo = await fetchLyricsHit({ v: ref.videoId }, signal);
		if (byVideo) return byVideo;
	}
	if (ref.id == null) return null;
	const { data, error } = await unisonFetch<UnisonEnvelope>(`/lyrics/${ref.id}`, {
		...(signal ? { signal } : {}),
	});
	if (error) {
		if (softMiss(error.status)) return null;
		throw new Error(`Unison HTTP ${error.status}`);
	}
	const hit = data?.data;
	return hit?.lyrics?.trim() && hit.format ? hit : null;
}

/** Exact metadata search only (no fuzzy `q` — avoids wrong-song hits). */
async function searchThenFetch(info: TrackSearchInfo, signal?: AbortSignal): Promise<UnisonHit | null> {
	const { data, error } = await unisonFetch<UnisonSearchEnvelope>("/lyrics/search", {
		query: { song: info.title, artist: info.artist, limit: 8 },
		...(signal ? { signal } : {}),
	});
	if (error) {
		if (softMiss(error.status)) return null;
		throw new Error(`Unison search HTTP ${error.status}`);
	}

	const ok = (data?.data ?? []).filter((h) => isAcceptableHit(h, info));
	if (!ok.length) return null;

	const target = info.durationSec > 0 ? Math.round(info.durationSec) : null;
	const candidate =
		target == null
			? ok[0]
			: [...ok].sort((a, b) => {
					const da = Math.abs((a.duration || 0) - target);
					const db = Math.abs((b.duration || 0) - target);
					if (da !== db) return da - db;
					return (b.matchScore ?? b.effectiveScore ?? 0) - (a.matchScore ?? a.effectiveScore ?? 0);
				})[0];

	const full = candidate.lyrics?.trim()
		? candidate
		: await fetchHitByRef({ videoId: candidate.videoId, id: candidate.id }, signal);
	return full && isAcceptableHit(full, info) ? full : null;
}

/**
 * Prefer `/lyrics?v=` then metadata; on miss, gated exact `/lyrics/search`.
 */
export async function searchUnison(
	info: TrackSearchInfo,
	options: UnisonSearchOptions = {},
): Promise<LyricResult | null> {
	const signal = options.signal;

	if (info.videoId) {
		const byVideo = await fetchLyricsHit({ v: info.videoId }, signal);
		if (byVideo) return toResult(byVideo, info, false);
	}

	const meta: Record<string, string | number> = {
		song: info.title,
		artist: info.artist,
	};
	if (info.durationSec > 0) meta.duration = Math.round(info.durationSec);
	if (info.album) meta.album = info.album;

	const direct = await fetchLyricsHit(meta, signal);
	if (direct && isAcceptableHit(direct, info)) return toResult(direct, info, false);

	const searched = await searchThenFetch(info, signal);
	return searched ? toResult(searched, info, true) : null;
}
