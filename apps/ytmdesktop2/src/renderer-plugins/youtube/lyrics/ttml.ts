import type { LyricLine, LyricWord } from "./types";

/** Parse TTML clock values (`ss.mmm`, `mm:ss.mmm`, `432.25s`, …) → ms. */
export function parseTtmlTime(raw: string | undefined | null): number {
	if (raw == null || raw === "") return 0;
	const offset = String(raw).match(/^([\d.]+)(h|m|s|ms)$/i);
	if (offset) {
		const value = Number.parseFloat(offset[1]);
		const unit = offset[2].toLowerCase();
		if (unit === "h") return Math.round(value * 3_600_000);
		if (unit === "m") return Math.round(value * 60_000);
		if (unit === "s") return Math.round(value * 1_000);
		return Math.round(value);
	}

	const parts = String(raw)
		.split(":")
		.map((p) => p.replace(/[^0-9.]/g, ""));
	try {
		if (parts.length === 1) return Math.round(Number.parseFloat(parts[0]) * 1000);
		if (parts.length === 2) {
			const minutes = Number.parseInt(parts[0], 10);
			const seconds = Number.parseFloat(parts[1]);
			return Math.round(minutes * 60_000 + seconds * 1000);
		}
		if (parts.length === 3) {
			const hours = Number.parseInt(parts[0], 10);
			const minutes = Number.parseInt(parts[1], 10);
			const seconds = Number.parseFloat(parts[2]);
			return Math.round(hours * 3_600_000 + minutes * 60_000 + seconds * 1000);
		}
	} catch {
		return 0;
	}
	return 0;
}

function attr(attrs: string, name: string): string | undefined {
	const re = new RegExp(`\\b${name}="([^"]*)"`, "i");
	return re.exec(attrs)?.[1];
}

/** Strip xmlns noise so simple tag regexes work. */
function stripXmlns(ttml: string): string {
	return ttml.replace(/\sxmlns(?::\w+)?="[^"]*"/g, "");
}

const OPEN_SPAN_RE = /^<span\b([^>]*)>/i;
const CLOSE_SPAN = "</span>";

/** Find matching `</span>` for an opening tag at `openEnd` (index of `>`). */
function findBalancedSpanEnd(inner: string, openEnd: number): number {
	let depth = 1;
	let i = openEnd + 1;
	while (i < inner.length && depth > 0) {
		const nextOpen = inner.slice(i).search(/<span\b/i);
		const nextClose = inner.toLowerCase().indexOf(CLOSE_SPAN, i);
		if (nextClose < 0) return -1;

		const openAt = nextOpen < 0 ? Number.POSITIVE_INFINITY : i + nextOpen;
		if (openAt < nextClose) {
			depth += 1;
			const gt = inner.indexOf(">", openAt);
			i = gt < 0 ? inner.length : gt + 1;
			continue;
		}
		depth -= 1;
		if (depth === 0) return nextClose;
		i = nextClose + CLOSE_SPAN.length;
	}
	return -1;
}

function parseSpanWords(inner: string): { text: string; words?: LyricWord[] } {
	const words: LyricWord[] = [];
	let text = "";
	let i = 0;

	const appendPlain = (plain: string) => {
		if (!plain) return;
		text += plain;
		if (words.length) words[words.length - 1].text += plain;
	};

	while (i < inner.length) {
		if (inner[i] !== "<") {
			const next = inner.indexOf("<", i);
			appendPlain(next < 0 ? inner.slice(i) : inner.slice(i, next));
			i = next < 0 ? inner.length : next;
			continue;
		}

		const open = OPEN_SPAN_RE.exec(inner.slice(i));
		if (open) {
			const attrs = open[1] ?? "";
			const openEnd = i + open[0].length - 1;
			const closeAt = findBalancedSpanEnd(inner, openEnd);
			if (closeAt < 0) {
				i += 1;
				continue;
			}
			const content = inner.slice(openEnd + 1, closeAt);
			i = closeAt + CLOSE_SPAN.length;

			const role = attr(attrs, "ttm:role") ?? attr(attrs, "role");
			if (role === "x-bg") {
				const nested = parseSpanWords(content);
				text += nested.text;
				if (nested.words?.length) words.push(...nested.words);
				continue;
			}

			const begin = attr(attrs, "begin");
			const end = attr(attrs, "end");
			if (begin == null || end == null) {
				const nested = parseSpanWords(content);
				appendPlain(nested.text);
				if (nested.words?.length) words.push(...nested.words);
				continue;
			}

			const startMs = parseTtmlTime(begin);
			const endMs = parseTtmlTime(end);
			// Timed leaf — content should be text (or nested syllables without own begin on outer).
			const leaf = content.includes("<span") ? parseSpanWords(content).text : content;
			words.push({
				timeMs: startMs,
				text: leaf,
				durationMs: Math.max(0, endMs - startMs),
			});
			text += leaf;
			continue;
		}

		// Skip unknown / closing tags so leftovers like stray markup never become lyric text.
		const gt = inner.indexOf(">", i);
		i = gt < 0 ? inner.length : gt + 1;
	}

	return words.length ? { text, words } : { text: text || inner.replace(/<[^>]+>/g, "") };
}

/**
 * Parse Apple-style lyric TTML (Better Lyrics / Unison) into timed lines.
 * Timed `<span begin end>` → word/syllable cues; nested `ttm:role="x-bg"` flattened.
 */
export function parseTtml(ttml: string): LyricLine[] {
	const cleaned = stripXmlns(ttml);
	const lines: LyricLine[] = [];
	const pRe = /<p\b([^>]*)>([\s\S]*?)<\/p>/gi;
	let match: RegExpExecArray | null;

	while ((match = pRe.exec(cleaned)) !== null) {
		const pAttrs = match[1] ?? "";
		const begin = attr(pAttrs, "begin");
		if (begin == null) continue;
		const startMs = parseTtmlTime(begin);
		const endRaw = attr(pAttrs, "end");
		const endMs = endRaw != null ? parseTtmlTime(endRaw) : null;
		const parsed = parseSpanWords(match[2] ?? "");
		const text = parsed.text.replace(/\s+/g, " ").trim() || parsed.text;
		lines.push({
			timeMs: startMs,
			text,
			durationMs: endMs != null && endMs >= startMs ? endMs - startMs : Number.POSITIVE_INFINITY,
			...(parsed.words?.length ? { words: parsed.words } : {}),
		});
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

export function ttmlHasWordSync(ttml: string): boolean {
	return /<span\b[^>]*\bbegin="/i.test(ttml);
}
