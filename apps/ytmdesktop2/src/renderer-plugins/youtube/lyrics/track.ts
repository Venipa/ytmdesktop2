import type { TrackSearchInfo } from "./types";

const AD_OR_NON_MUSIC = new Set([
	"MUSIC_VIDEO_TYPE_OMV", // still music — keep
]);

/** True when we should not fetch lyrics for this player payload. */
export function shouldSkipTrack(info: Partial<TrackSearchInfo> | null | undefined): string | null {
	if (!info?.videoId || !info.title) return "Missing track metadata";
	if (info.isLiveContent) return "Live content";
	if (!info.artist?.trim()) return "Missing artist";
	if (!info.durationSec || info.durationSec < 5) return "Track too short";

	const type = String(info.musicVideoType ?? "");
	if (type.includes("PODCAST") || type.includes("EPISODE")) return "Podcast";
	// YTM ads often lack normal music types / have tiny duration already handled
	void AD_OR_NON_MUSIC;
	return null;
}

export function trackInfoFromPlayer(playerApi: {
	getPlayerResponse?: () => any;
	getVideoData?: () => any;
}): TrackSearchInfo | null {
	const response = playerApi.getPlayerResponse?.();
	const details = response?.videoDetails;
	if (!details?.videoId) return null;

	const micro = response?.microformat?.microformatDataRenderer;
	const author = String(details.author ?? "");
	const title = String(details.title ?? "");
	const durationSec = Number(details.lengthSeconds ?? 0);

	let album: string | undefined;
	try {
		const bar = document.querySelector("ytmusic-app-layout>ytmusic-player-bar") as any;
		const albumRun = bar?.querySelector?.(".subtitle a")?.textContent;
		if (albumRun) album = String(albumRun);
	} catch {
		/* ignore */
	}

	return {
		videoId: String(details.videoId),
		title,
		artist: author,
		album,
		durationSec,
		musicVideoType: String(details.musicVideoType ?? micro?.musicVideoType ?? ""),
		isLiveContent: !!details.isLiveContent,
	};
}
