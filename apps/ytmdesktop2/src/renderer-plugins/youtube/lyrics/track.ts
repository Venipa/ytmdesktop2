import { webFrame } from "electron";
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
	void AD_OR_NON_MUSIC;
	return null;
}

const TRACK_INFO_SCRIPT = `(() => {
  const selectors = ["body>ytmusic-app", "ytmusic-app-layout>ytmusic-player-bar"];
  let api = null;
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el && el.playerApi) { api = el.playerApi; break; }
  }
  if (!api || typeof api.getPlayerResponse !== "function") return null;
  let response;
  try { response = api.getPlayerResponse(); } catch (e) { return null; }
  const details = response && response.videoDetails;
  if (!details || !details.videoId) return null;
  const micro = response.microformat && response.microformat.microformatDataRenderer;
  let album;
  try {
    const bar = document.querySelector("ytmusic-app-layout>ytmusic-player-bar");
    const albumRun = bar && bar.querySelector && bar.querySelector(".subtitle a");
    if (albumRun && albumRun.textContent) album = String(albumRun.textContent);
  } catch (e) {}
  return {
    videoId: String(details.videoId),
    title: String(details.title || ""),
    artist: String(details.author || ""),
    album: album,
    durationSec: Number(details.lengthSeconds || 0),
    musicVideoType: String(details.musicVideoType || (micro && micro.musicVideoType) || ""),
    isLiveContent: !!details.isLiveContent
  };
})()`;

/**
 * Read track metadata in page main world.
 * Isolated preload getPlayerResponse is unreliable under contextIsolation.
 */
export async function trackInfoFromMainWorld(): Promise<TrackSearchInfo | null> {
	try {
		const info = await webFrame.executeJavaScript(TRACK_INFO_SCRIPT);
		if (!info || typeof info !== "object" || !info.videoId) return null;
		return info as TrackSearchInfo;
	} catch {
		return null;
	}
}

/** @deprecated Prefer trackInfoFromMainWorld under isolation. */
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

const CURRENT_TIME_SCRIPT = `(() => {
  const selectors = ["body>ytmusic-app", "ytmusic-app-layout>ytmusic-player-bar"];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    const api = el && el.playerApi;
    if (api && typeof api.getCurrentTime === "function") {
      try { return Number(api.getCurrentTime()) || 0; } catch (e) { return 0; }
    }
  }
  return 0;
})()`;

export async function playerCurrentTimeSec(): Promise<number> {
	try {
		return Number(await webFrame.executeJavaScript(CURRENT_TIME_SCRIPT)) || 0;
	} catch {
		return 0;
	}
}

export function seekPlayerScript(timeSec: number): string {
	const t = Number(timeSec) || 0;
	return `(() => {
  const selectors = ["body>ytmusic-app", "ytmusic-app-layout>ytmusic-player-bar"];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    const api = el && el.playerApi;
    if (api && typeof api.seekTo === "function") {
      try { api.seekTo(${t}, true); return true; } catch (e) { return false; }
    }
  }
  return false;
})()`;
}
