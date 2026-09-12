import { lyricsPage } from "../../lyrics.page";
import type { LyricLine, LyricResult, LyricWord, TrackSearchInfo, YouTubeCaptionTrack, YouTubeCaptionTracks } from "../types";

/**
 * YouTube's own caption track on the current video, as a last-resort line-synced source.
 * Only music videos / live sessions with a human-made caption track qualify — auto-generated (ASR)
 * captions mishear sung lyrics badly, so they are ignored (same call the Better Lyrics extension makes).
 */

const FETCH_TIMEOUT_MS = 10_000;
const MIN_LINES = 2;
/** Cue text that is a sound cue, not a lyric: `[Music]`, `(applause)`, `♪`. */
const NON_LYRIC_RE = /^[\s♪♫𝅘𝅥𝅮𝅘𝅥𝅯𝅘𝅥𝅰𝅘𝅥𝅱𝅘𝅥𝅲[\]()]*$|^\s*[[(][^\])]*[\])]\s*$/u;
const NOTE_EDGES_RE = /^[\s♪♫𝅘𝅥𝅮𝅘𝅥𝅯𝅘𝅥𝅰𝅘𝅥𝅱𝅘𝅥𝅲]+|[\s♪♫𝅘𝅥𝅮𝅘𝅥𝅯𝅘𝅥𝅰𝅘𝅥𝅱𝅘𝅥𝅲]+$/gu;

export interface YouTubeCaptionsSearchOptions {
	signal?: AbortSignal;
	/** Injectable for tests; defaults to the page bridge. */
	loadTracks?: () => Promise<YouTubeCaptionTracks | null>;
	fetchJson?: (url: string, signal: AbortSignal) => Promise<unknown>;
}

/** `fmt=json3` payload (only the fields we use). */
interface Json3Event {
	tStartMs?: number;
	dDurationMs?: number;
	/** Rolling-caption append marker (ASR); such events are continuations, not new lines. */
	aAppend?: number;
	segs?: { utf8?: string; tOffsetMs?: number }[];
}

function baseLang(code: string): string {
	return code.toLowerCase().split(/[-_]/)[0];
}

/**
 * Pick the human-made track that most likely holds the sung lyrics:
 * same language as the ASR track (the video's spoken language) → first non-translated → first manual.
 */
export function pickCaptionTrack(tracks: YouTubeCaptionTrack[]): YouTubeCaptionTrack | null {
	const manual = tracks.filter((t) => !t.isAuto);
	if (!manual.length) return null;
	const spoken = tracks.find((t) => t.isAuto)?.languageCode;
	if (spoken) {
		const match = manual.find((t) => baseLang(t.languageCode) === baseLang(spoken));
		if (match) return match;
	}
	return manual[0];
}

function cleanCueText(raw: string): string {
	return raw.replace(/\n+/g, " ").replace(NOTE_EDGES_RE, "").replace(/\s+/g, " ").trim();
}

/** Convert `fmt=json3` events to timed lines; per-segment offsets (when present) become word cues. */
export function parseJson3Captions(payload: unknown): LyricLine[] {
	const events = (payload as { events?: Json3Event[] } | null)?.events;
	if (!Array.isArray(events)) return [];

	const lines: LyricLine[] = [];
	for (const ev of events) {
		if (!ev || typeof ev.tStartMs !== "number" || !Array.isArray(ev.segs) || ev.aAppend) continue;
		const startMs = ev.tStartMs;
		const durationMs = typeof ev.dDurationMs === "number" && ev.dDurationMs > 0 ? ev.dDurationMs : Number.POSITIVE_INFINITY;

		const segs = ev.segs.filter((s) => typeof s?.utf8 === "string");
		const text = cleanCueText(segs.map((s) => s.utf8).join(""));
		if (!text || NON_LYRIC_RE.test(text)) continue;

		// Per-segment offsets (first seg is implicitly at +0) give word cues; otherwise the cue is one line.
		const timed = segs.length > 1 && segs.slice(1).every((s) => typeof s.tOffsetMs === "number");
		const words: LyricWord[] = [];
		if (timed) {
			for (let i = 0; i < segs.length; i++) {
				const wordText = String(segs[i].utf8).replace(/\n/g, " ");
				if (!wordText.trim() && i < segs.length - 1) continue;
				const wordStart = startMs + (segs[i].tOffsetMs ?? 0);
				const wordEnd = segs[i + 1] ? startMs + (segs[i + 1].tOffsetMs ?? 0) : Number.isFinite(durationMs) ? startMs + durationMs : wordStart;
				words.push({ timeMs: wordStart, text: wordText, durationMs: Math.max(0, wordEnd - wordStart) });
			}
		}

		lines.push({ timeMs: startMs, text, durationMs, ...(words.length > 1 ? { words } : {}) });
	}

	lines.sort((a, b) => a.timeMs - b.timeMs);
	for (let i = 0; i < lines.length; i++) {
		if (Number.isFinite(lines[i].durationMs)) continue;
		const next = lines[i + 1];
		lines[i].durationMs = next ? Math.max(0, next.timeMs - lines[i].timeMs) : Number.POSITIVE_INFINITY;
	}
	if (lines[0] && lines[0].timeMs > 300) {
		lines.unshift({ timeMs: 0, text: "", durationMs: lines[0].timeMs });
	}
	return lines;
}

/** ALL-CAPS caption tracks are common on MVs; sentence-case them so they don't shout. */
export function normalizeCaptionCase(lines: LyricLine[]): LyricLine[] {
	const textual = lines.filter((l) => l.text.trim());
	const letters = textual.map((l) => l.text).join("");
	if (!/[a-z]/i.test(letters) || letters !== letters.toUpperCase()) return lines;
	const sentence = (s: string) => (s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s);
	return lines.map((l) => ({
		...l,
		text: sentence(l.text),
		...(l.words ? { words: l.words.map((w, i) => ({ ...w, text: i === 0 ? sentence(w.text) : w.text.toLowerCase() })) } : {}),
	}));
}

async function defaultLoadTracks(): Promise<YouTubeCaptionTracks | null> {
	try {
		return await lyricsPage.request("captionTracks");
	} catch {
		return null;
	}
}

async function defaultFetchJson(url: string, signal: AbortSignal): Promise<unknown> {
	const res = await fetch(url, { signal, credentials: "include" });
	if (!res.ok) throw new Error(`YouTube captions HTTP ${res.status}`);
	const body = await res.text();
	// Empty body = signature expired / proof-of-origin gate; treat as a miss, not a parse crash.
	return body ? JSON.parse(body) : null;
}

export async function searchYouTubeCaptions(
	info: TrackSearchInfo,
	options: YouTubeCaptionsSearchOptions = {},
): Promise<LyricResult | null> {
	const loaded = await (options.loadTracks ?? defaultLoadTracks)();
	// The player only knows the current video — never attribute its captions to a different track.
	if (!loaded || loaded.videoId !== info.videoId || !loaded.tracks.length) return null;

	const track = pickCaptionTrack(loaded.tracks);
	if (!track) return null;

	const url = new URL(track.url);
	url.searchParams.set("fmt", "json3");

	const signals = [AbortSignal.timeout(FETCH_TIMEOUT_MS), ...(options.signal ? [options.signal] : [])];
	const payload = await (options.fetchJson ?? defaultFetchJson)(url.toString(), AbortSignal.any(signals));

	const lines = normalizeCaptionCase(parseJson3Captions(payload));
	if (lines.filter((l) => l.text.trim()).length < MIN_LINES) return null;
	const hasWordSync = lines.some((l) => !!l.words?.length);

	return {
		title: info.title,
		artists: info.artist.split(/[&,]/).map((s) => s.trim()).filter(Boolean),
		lines,
		inexact: false,
		provider: "youtube-captions",
		hasWordSync,
		syncLevel: hasWordSync ? "word" : "line",
	};
}
