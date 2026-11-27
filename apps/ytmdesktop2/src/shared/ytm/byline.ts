/** One text run of a YTM byline such as `longBylineText` ("A, B & C • Album • 2024"). */
export interface YtmBylineRun {
	text?: string;
}

/** Runs YTM puts between artist names. */
const ARTIST_SEPARATORS = new Set([",", "&"]);
/** Run that ends the artist part of the byline. */
const SECTION_SEPARATOR = "•";

/**
 * Artist names from the start of a byline, one entry per artist run.
 * A name that contains "&" or "," ("Earth, Wind & Fire") is one run, so it stays whole.
 */
export function artistsFromBylineRuns(runs: readonly YtmBylineRun[] | null | undefined): string[] {
	const artists: string[] = [];
	if (!runs) return artists;
	for (const run of runs) {
		const text = String(run?.text ?? "").trim();
		if (text === SECTION_SEPARATOR) break;
		if (!text || ARTIST_SEPARATORS.has(text)) continue;
		artists.push(text);
	}
	return artists;
}

/** Video id of a YTM renderer (`playlistPanelVideoRenderer` or the flat player bar item). */
export function rendererVideoId(renderer: unknown): string | null {
	if (!renderer || typeof renderer !== "object") return null;
	const r = renderer as {
		videoId?: string;
		navigationEndpoint?: { watchEndpoint?: { videoId?: string } };
	};
	const id = r.videoId || r.navigationEndpoint?.watchEndpoint?.videoId;
	return typeof id === "string" && id ? id : null;
}

/**
 * Byline of the player bar item (`ytmusic-player-bar.currentItem`) for this video: the flat item,
 * or the song or video entry of a Song/Video wrapper. Undefined while the item still belongs to the previous video.
 */
export function bylineRunsForVideo<R extends YtmBylineRun>(item: Record<string, any> | null | undefined, videoId: string): R[] | undefined {
	const wrapper = item?.playlistPanelVideoWrapperRenderer ?? item;
	const entries = [
		item,
		item?.playlistPanelVideoRenderer,
		wrapper?.primaryRenderer?.playlistPanelVideoRenderer,
		wrapper?.counterpart?.[0]?.counterpartRenderer?.playlistPanelVideoRenderer,
	];
	const entry = entries.find((e) => e?.longBylineText?.runs && rendererVideoId(e) === videoId);
	return entry?.longBylineText.runs;
}
