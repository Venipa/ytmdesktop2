import type { TrackSearchInfo } from "./types";
import { lyricsPage } from "../lyrics.page";

const AD_OR_NON_MUSIC = new Set([
	"MUSIC_VIDEO_TYPE_OMV", // still music - keep
]);

const TRACK_INFO_RETRY_MS = 120;
const TRACK_INFO_TIMEOUT_MS = 5_000;

/** True when we should not fetch lyrics for this player payload. */
export function shouldSkipTrack(info: Partial<TrackSearchInfo> | null | undefined): string | null {
	if (!info?.videoId || !info.title) return "Missing track metadata";
	if (info.isLiveContent) return "Live content";
	if (!info.artist?.trim()) return "Missing artist";
	if (!info.durationSec || info.durationSec < 5) return "Track too short";

	const type = String(info.musicVideoType ?? "");
	if (type.includes("PODCAST") || type.includes("EPISODE")) return "Podcast";
	void AD_OR_NON_MUSIC;
	return null;
}

function wait(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readTrackInfoOnce(): Promise<TrackSearchInfo | null> {
	try {
		return await lyricsPage.request("trackInfo");
	} catch {
		return null;
	}
}

function hasUsableTrackInfo(info: TrackSearchInfo | null, expectVideoId?: string | null): boolean {
	if (!info?.videoId || !info.title?.trim()) return false;
	if (expectVideoId && info.videoId !== expectVideoId) return false;
	return true;
}

/**
 * Read track metadata via page bridge.
 * Retries while YTM swaps tracks (trackId:change often fires before response is ready).
 */
export async function trackInfoFromMainWorld(options?: {
	expectVideoId?: string | null;
	timeoutMs?: number;
}): Promise<TrackSearchInfo | null> {
	const expectVideoId = options?.expectVideoId ?? null;
	const timeoutMs = options?.timeoutMs ?? TRACK_INFO_TIMEOUT_MS;
	const deadline = Date.now() + timeoutMs;

	while (Date.now() <= deadline) {
		const info = await readTrackInfoOnce();
		if (hasUsableTrackInfo(info, expectVideoId)) return info;
		await wait(TRACK_INFO_RETRY_MS);
	}

	const finalInfo = await readTrackInfoOnce();
	if (hasUsableTrackInfo(finalInfo, expectVideoId)) return finalInfo;
	if (expectVideoId && finalInfo && finalInfo.videoId !== expectVideoId) return null;
	return finalInfo;
}

export async function playerCurrentTimeSec(): Promise<number> {
	try {
		return Number(await lyricsPage.request("currentTime")) || 0;
	} catch {
		return 0;
	}
}

/** Prefer `subscribeLyricsTime` + startClock for UI; this is one-shot only. */
export async function startLyricsClock(): Promise<boolean> {
	try {
		return !!(await lyricsPage.request("startClock"));
	} catch {
		return false;
	}
}

export function stopLyricsClock(): void {
	lyricsPage.notify("stopClock");
}

/** Seek player in page world (seconds). */
export async function seekPlayer(timeSec: number): Promise<boolean> {
	try {
		return !!(await lyricsPage.request("seek", timeSec));
	} catch {
		return false;
	}
}
