import type { LyricLine, LyricWord } from "./types";

const TIMESTAMP_RE = /^\[(\d+):(\d+)(?:\.(\d+))?\]/;
const WORD_TIMESTAMP_RE = /<(\d+):(\d+)(?:\.(\d+))?>/g;
const TAG_RE = /^\[(\w+):\s*(.+?)\s*\]$/;
/** Starts within this gap of previous line → same concurrent group (duets / stacked vocals). */
export const CONCURRENT_START_WINDOW_MS = 280;

function timestampToMs(minutes: string, seconds: string, frac?: string): number {
	const msPart = (frac ?? "0").padEnd(3, "0").slice(0, 3);
	return parseInt(minutes, 10) * 60_000 + parseInt(seconds, 10) * 1_000 + parseInt(msPart, 10);
}

function assignDurations(lines: LyricLine[]): void {
	for (let i = 0; i < lines.length; i++) {
		lines[i].durationMs = lines[i + 1]
			? lines[i + 1].timeMs - lines[i].timeMs
			: Number.POSITIVE_INFINITY;
		assignWordDurations(lines[i]);
	}
}

/** Fill each word's duration from next word (or remainder of line). */
export function assignWordDurations(line: LyricLine): void {
	const words = line.words;
	if (!words?.length) return;
	for (let i = 0; i < words.length; i++) {
		if (words[i + 1]) {
			words[i].durationMs = Math.max(0, words[i + 1].timeMs - words[i].timeMs);
			continue;
		}
		if (Number.isFinite(line.durationMs)) {
			words[i].durationMs = Math.max(0, line.timeMs + line.durationMs - words[i].timeMs);
		} else {
			words[i].durationMs = Number.POSITIVE_INFINITY;
		}
	}
}

/**
 * Parse enhanced LRC body after line stamps: `<mm:ss.xx>word <mm:ss.xx>word…`.
 * Returns plain text when no word stamps present.
 */
export function parseEnhancedWords(rest: string): { text: string; words?: LyricWord[] } {
	WORD_TIMESTAMP_RE.lastIndex = 0;
	if (!WORD_TIMESTAMP_RE.test(rest)) {
		return { text: rest.trim() };
	}

	WORD_TIMESTAMP_RE.lastIndex = 0;
	const markers: { index: number; end: number; timeMs: number }[] = [];
	let match: RegExpExecArray | null;
	while ((match = WORD_TIMESTAMP_RE.exec(rest)) !== null) {
		markers.push({
			index: match.index,
			end: match.index + match[0].length,
			timeMs: timestampToMs(match[1], match[2], match[3]),
		});
	}
	if (!markers.length) return { text: rest.trim() };

	const words: LyricWord[] = [];
	const prefix = rest.slice(0, markers[0].index);
	if (prefix.trim()) {
		words.push({
			timeMs: markers[0].timeMs,
			text: prefix,
			durationMs: Number.POSITIVE_INFINITY,
		});
	}

	for (let i = 0; i < markers.length; i++) {
		const start = markers[i].end;
		const end = i + 1 < markers.length ? markers[i + 1].index : rest.length;
		const text = rest.slice(start, end);
		if (!text.length && i < markers.length - 1) continue;
		words.push({
			timeMs: markers[i].timeMs,
			text: text.length ? text : " ",
			durationMs: Number.POSITIVE_INFINITY,
		});
	}

	const text = words.map((w) => w.text).join("").replace(/\s+/g, " ").trim();
	return words.length ? { text, words } : { text: rest.trim() };
}

/**
 * Collapse near-simultaneous LRC rows into one line with `parts`.
 * Chain-merges while each next start is within `windowMs` of previous member.
 * Word cues kept only for single-member clusters (duet merge drops karaoke timing).
 */
export function groupConcurrentLines(
	lines: LyricLine[],
	windowMs: number = CONCURRENT_START_WINDOW_MS,
): LyricLine[] {
	if (lines.length <= 1) {
		assignDurations(lines);
		return lines;
	}

	const grouped: LyricLine[] = [];
	let i = 0;
	while (i < lines.length) {
		const cluster = [lines[i]];
		let j = i + 1;
		while (j < lines.length && lines[j].timeMs - cluster[cluster.length - 1].timeMs <= windowMs) {
			cluster.push(lines[j]);
			j++;
		}

		if (cluster.length === 1) {
			grouped.push({
				timeMs: cluster[0].timeMs,
				text: cluster[0].text,
				durationMs: Number.POSITIVE_INFINITY,
				parts: cluster[0].parts,
				words: cluster[0].words,
			});
		} else {
			const parts = cluster.map((c) => c.text).filter((t) => t.length > 0);
			grouped.push({
				timeMs: cluster[0].timeMs,
				text: parts.join("\n"),
				durationMs: Number.POSITIVE_INFINITY,
				parts: parts.length > 1 ? parts : undefined,
			});
		}
		i = j;
	}

	assignDurations(grouped);
	return grouped;
}

/** Parse LRC text into timed lines (leading silence cue if first line > 300ms). */
export function parseLrc(text: string): LyricLine[] {
	const lines: LyricLine[] = [];
	let offset = 0;

	for (let raw of text.split("\n")) {
		raw = raw.trim();
		if (!raw.startsWith("[")) continue;

		const stamps: number[] = [];
		let rest = raw;
		let match = rest.match(TIMESTAMP_RE);
		while (match) {
			stamps.push(timestampToMs(match[1], match[2], match[3]));
			rest = rest.slice(match[0].length);
			match = rest.match(TIMESTAMP_RE);
		}

		if (!stamps.length) {
			const tag = raw.match(TAG_RE);
			if (tag?.[1] === "offset") offset = parseInt(tag[2], 10) || 0;
			continue;
		}

		const parsed = parseEnhancedWords(rest);
		// Multi-stamp rows rarely carry enhanced words; attach words only once.
		for (let s = 0; s < stamps.length; s++) {
			lines.push({
				timeMs: stamps[s],
				text: parsed.text,
				durationMs: Number.POSITIVE_INFINITY,
				...(s === 0 && parsed.words ? { words: parsed.words.map((w) => ({ ...w })) } : {}),
			});
		}
	}

	lines.sort((a, b) => a.timeMs - b.timeMs);
	for (const line of lines) {
		line.timeMs += offset;
		if (line.words) {
			for (const word of line.words) word.timeMs += offset;
		}
	}

	const grouped = groupConcurrentLines(lines);

	const first = grouped[0];
	if (first && first.timeMs > 300) {
		grouped.unshift({
			timeMs: 0,
			text: "",
			durationMs: first.timeMs,
		});
		assignDurations(grouped);
	}

	return grouped;
}

/** Active line index for current playback time (binary search). */
export function activeLineIndex(lines: LyricLine[], timeMs: number): number {
	if (!lines.length) return -1;
	let lo = 0;
	let hi = lines.length - 1;
	let ans = 0;
	while (lo <= hi) {
		const mid = (lo + hi) >> 1;
		if (lines[mid].timeMs <= timeMs) {
			ans = mid;
			lo = mid + 1;
		} else {
			hi = mid - 1;
		}
	}
	return ans;
}

/** Active word index within a line (binary search). `-1` when before first word. */
export function activeWordIndex(words: LyricWord[], timeMs: number): number {
	if (!words.length) return -1;
	if (timeMs < words[0].timeMs) return -1;
	let lo = 0;
	let hi = words.length - 1;
	let ans = 0;
	while (lo <= hi) {
		const mid = (lo + hi) >> 1;
		if (words[mid].timeMs <= timeMs) {
			ans = mid;
			lo = mid + 1;
		} else {
			hi = mid - 1;
		}
	}
	return ans;
}

/** Fallback span when last line has infinite duration. */
export const SYNTH_FALLBACK_LINE_MS = 3000;
/** Need at least this many tokens before estimating word times. */
export const SYNTH_MIN_WORDS = 2;

/**
 * Estimate word times by splitting line text across `durationMs`.
 * Skips duet `parts` rows and single-token lines (keep normal line sync).
 */
export function synthesizeLineWords(line: LyricLine): LyricWord[] | undefined {
	if (line.words?.length) return undefined;
	if (line.parts && line.parts.length > 1) return undefined;
	const raw = line.text?.trim();
	if (!raw) return undefined;
	const tokens = raw.match(/\S+\s*/g);
	if (!tokens || tokens.length < SYNTH_MIN_WORDS) return undefined;

	const span =
		Number.isFinite(line.durationMs) && line.durationMs > 0 ? line.durationMs : SYNTH_FALLBACK_LINE_MS;
	const slice = span / tokens.length;
	return tokens.map((text, i) => ({
		timeMs: line.timeMs + Math.floor(i * slice),
		text,
		durationMs: Math.max(1, Math.floor(slice)),
	}));
}

/** Enhanced words if present; otherwise soft-synth when `enabled`. */
export function resolveLineWords(line: LyricLine, enabled: boolean): LyricWord[] | undefined {
	if (!enabled) return undefined;
	if (line.words?.length) return line.words;
	return synthesizeLineWords(line);
}

/** True when any line has real enhanced `<…>` cues (not estimated). */
export function hasEnhancedWordSync(lines: LyricLine[]): boolean {
	return lines.some((line) => !!line.words?.length);
}

/** True when word sync UI can paint at least one line (enhanced or synth). */
export function canWordSync(lines: LyricLine[]): boolean {
	return lines.some((line) => !!resolveLineWords(line, true)?.length);
}
