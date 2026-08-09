export const LYRICS_ROOT_ID = "ytmd-lyrics-root";

/** Prefer page-type; fall back to 2nd tab header (YTM lyrics). */
export const SELECTORS = {
	/** Pear: Lyrics is 2nd tab header on player page. */
	lyricsTabHeader: "#tabsContent > .tab-header:nth-of-type(2)",
	tabHeaders: "#tabsContent > .tab-header",
	lyricsTabBody: '#tab-renderer[page-type="MUSIC_PAGE_TYPE_TRACK_LYRICS"]',
	tabRenderer: "#tab-renderer",
} as const;

export function lyricsRootSelector(): string {
	return `#${LYRICS_ROOT_ID}`;
}
