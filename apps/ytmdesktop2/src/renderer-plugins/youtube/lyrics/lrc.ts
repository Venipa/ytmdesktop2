import type { LyricLine } from "./types";

const TIMESTAMP_RE = /^\[(\d+):(\d+)(?:\.(\d+))?\]/;
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
	}
}

/**
 * Collapse near-simultaneous LRC rows into one line with `parts`.
 * Chain-merges while each next start is within `windowMs` of previous member.
 */
export function groupConcurrentLines(
	lines: LyricLine[],
	windowMs: number = CONCURRENT_START_WINDOW_MS,
): LyricLine[] {
	if (lines.length <= 1) return lines;

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

		const lineText = rest.replace(/<\d+:\d+(?:\.\d+)?>\s*/g, "").trim();
		for (const timeMs of stamps) {
			lines.push({ timeMs, text: lineText, durationMs: Number.POSITIVE_INFINITY });
		}
	}

	lines.sort((a, b) => a.timeMs - b.timeMs);
	for (const line of lines) line.timeMs += offset;

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
