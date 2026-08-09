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

function parseSpanWords(inner: string): { text: string; words?: LyricWord[] } {
	const words: LyricWord[] = [];
	let text = "";
	const tokenRe = /<span\b([^>]*)>([\s\S]*?)<\/span>|([^<]+)/gi;
	let match: RegExpExecArray | null;
	while ((match = tokenRe.exec(inner)) !== null) {
		if (match[3] != null) {
			const plain = match[3];
			text += plain;
			if (words.length) words[words.length - 1].text += plain;
			continue;
		}

		const spanAttrs = match[1] ?? "";
		const role = attr(spanAttrs, "ttm:role") ?? attr(spanAttrs, "role");
		// Background vocal containers — flatten nested timed spans.
		if (role === "x-bg") {
			const nested = parseSpanWords(match[2] ?? "");
			text += nested.text;
			if (nested.words?.length) words.push(...nested.words);
			continue;
		}

		const begin = attr(spanAttrs, "begin");
		const end = attr(spanAttrs, "end");
		const spanText = match[2] ?? "";
		if (begin == null || end == null) {
			text += spanText;
			if (words.length) words[words.length - 1].text += spanText;
			continue;
		}

		const startMs = parseTtmlTime(begin);
		const endMs = parseTtmlTime(end);
		words.push({
			timeMs: startMs,
			text: spanText,
			durationMs: Math.max(0, endMs - startMs),
		});
		text += spanText;
	}

	return words.length ? { text, words } : { text: text || inner.replace(/<[^>]+>/g, "") };
}

/**
 * Parse Apple-style lyric TTML (Better Lyrics / Binimum) into timed lines.
 * Timed `<span begin end>` → word/syllable cues; otherwise line-only.
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
