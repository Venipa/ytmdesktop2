import { findLyricsBody, LYRICS_ROOT_ID } from "./selectors";

const STOCK_MIN_CHARS = 40;

export type LyricsTabDisplayMode = "overlay" | "stock";

/** True when YTM already paints usable plain lyrics in the Lyrics tab. */
export function ytmHasStockLyrics(body: HTMLElement | null = findLyricsBody()): boolean {
	if (!body) return false;

	const shelf = body.querySelector("ytmusic-description-shelf-renderer");
	if (shelf) {
		const text = (shelf.textContent ?? "").replace(/\s+/g, " ").trim();
		if (text.length >= STOCK_MIN_CHARS) return true;
	}

	for (const child of Array.from(body.children)) {
		if (!(child instanceof HTMLElement) || child.id === LYRICS_ROOT_ID) continue;
		const text = (child.textContent ?? "").replace(/\s+/g, " ").trim();
		if (text.length >= STOCK_MIN_CHARS) return true;
	}
	return false;
}

/** Overlay = our UI; stock = show native YTM lyrics, hide `#ytmd-lyrics-root`. */
export function setLyricsTabDisplayMode(mode: LyricsTabDisplayMode): void {
	findLyricsBody()?.setAttribute("data-ytmd-lyrics", mode);
}

export function clearLyricsTabDisplayMode(): void {
	findLyricsBody()?.removeAttribute("data-ytmd-lyrics");
}

/**
 * Prefer timed overlay. Plain/empty/error defer to stock YTM when present.
 */
export function resolveLyricsDisplay(input: {
	status: string;
	hasTimedLines: boolean;
	hasStock: boolean;
}): { mode: LyricsTabDisplayMode; status: "stock" | null } {
	if (input.hasTimedLines) return { mode: "overlay", status: null };
	if (input.status === "loading" || input.status === "idle" || input.status === "skipped") {
		return { mode: "overlay", status: null };
	}
	if (input.hasStock) return { mode: "stock", status: "stock" };
	return { mode: "overlay", status: null };
}
