import { definePageCmds } from "@plugins/define-bridge";
import type { TrackSearchInfo } from "./lyrics/types";
import { resolveYtmStore } from "./ytm-store";
import { getPagePlayerApi } from "./world0/context";

function readAlbumTitle(): string | undefined {
	try {
		const bar = document.querySelector("ytmusic-app-layout>ytmusic-player-bar");
		const albumRun = bar?.querySelector?.(".subtitle a")?.textContent;
		if (albumRun) return String(albumRun);
	} catch {
		/* ignore */
	}
	return undefined;
}

/** Page-world track snapshot (playerApi / getVideoData). */
export function readTrackInfoFromPlayer(): TrackSearchInfo | null {
	const api = getPagePlayerApi();
	if (!api) return null;

	let details: Record<string, unknown> | null = null;
	let micro: Record<string, unknown> | null = null;
	try {
		const response = api.getPlayerResponse?.() as
			| {
					videoDetails?: Record<string, unknown>;
					microformat?: { microformatDataRenderer?: Record<string, unknown> };
			  }
			| undefined;
		details = response?.videoDetails ?? null;
		micro = response?.microformat?.microformatDataRenderer ?? null;
	} catch {
		/* mid-nav */
	}

	type VideoData = {
		video_id?: string;
		title?: string;
		author?: string;
		lengthSeconds?: number;
		length_seconds?: number;
	};
	let videoData: VideoData | null = null;
	try {
		videoData = (api.getVideoData?.() as VideoData | undefined) ?? null;
	} catch {
		/* ignore */
	}

	const videoId = String(details?.videoId || videoData?.video_id || "");
	if (!videoId) return null;

	return {
		videoId,
		title: String(details?.title || videoData?.title || ""),
		artist: String(details?.author || videoData?.author || ""),
		album: readAlbumTitle(),
		durationSec: Number(details?.lengthSeconds || videoData?.lengthSeconds || videoData?.length_seconds || 0),
		musicVideoType: String(details?.musicVideoType || micro?.musicVideoType || ""),
		isLiveContent: !!details?.isLiveContent,
	};
}

function readCurrentTimeSec(): number {
	const api = getPagePlayerApi();
	if (!api || typeof api.getCurrentTime !== "function") return 0;
	try {
		return Number(api.getCurrentTime()) || 0;
	} catch {
		return 0;
	}
}

function seekToSec(timeSec: number): boolean {
	const api = getPagePlayerApi();
	if (!api || typeof api.seekTo !== "function") return false;
	try {
		api.seekTo(Number(timeSec) || 0);
		return true;
	} catch {
		return false;
	}
}

function parseDurationSec(text: unknown): number {
	if (typeof text !== "string" || !text.trim()) return 0;
	const parts = text
		.trim()
		.split(":")
		.map((p) => Number(p));
	if (!parts.length || parts.some((n) => !Number.isFinite(n))) return 0;
	if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
	if (parts.length === 2) return parts[0] * 60 + parts[1];
	return parts[0] || 0;
}

function queueItemRenderer(item: unknown): Record<string, any> | null {
	const root = item as Record<string, any> | null;
	if (!root) return null;
	return (
		root.playlistPanelVideoRenderer ??
		root.playlistPanelVideoWrapperRenderer?.primaryRenderer?.playlistPanelVideoRenderer ??
		root.playlistPanelVideoWrapperRenderer?.counterpart?.[0]?.counterpartRenderer?.playlistPanelVideoRenderer ??
		(root.videoId || root.title ? root : null)
	);
}

function queueItemToTrackInfo(item: unknown): TrackSearchInfo | null {
	const renderer = queueItemRenderer(item);
	if (!renderer) return null;

	const videoId =
		(typeof renderer.videoId === "string" && renderer.videoId) ||
		renderer.navigationEndpoint?.watchEndpoint?.videoId ||
		undefined;
	if (!videoId) return null;

	const title =
		renderer.title?.runs?.[0]?.text ||
		renderer.title?.simpleText ||
		renderer.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text ||
		"";
	const artist =
		renderer.shortBylineText?.runs?.[0]?.text ||
		renderer.longBylineText?.runs?.[0]?.text ||
		renderer.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text ||
		"";
	const lengthText = renderer.lengthText?.simpleText || renderer.lengthText?.runs?.[0]?.text || "";

	return {
		videoId: String(videoId),
		title: String(title || ""),
		artist: String(artist || ""),
		durationSec: parseDurationSec(lengthText),
		musicVideoType: String(renderer.navigationEndpoint?.watchEndpoint?.watchEndpointMusicSupportedConfigs?.watchEndpointMusicConfig?.musicVideoType || ""),
		isLiveContent: false,
	};
}

/**
 * Next queue item after the current player video (play-order index + 1).
 * Returns null when queue unknown / at end.
 */
export function readNextTrackInfoFromQueue(): TrackSearchInfo | null {
	const currentId = readTrackInfoFromPlayer()?.videoId;
	if (!currentId) return null;

	const items = resolveYtmStore()?.getState?.()?.queue?.items ?? [];
	if (!items.length) return null;

	const currentIndex = items.findIndex((item) => queueItemToTrackInfo(item)?.videoId === currentId);
	if (currentIndex < 0) return null;

	const next = items[currentIndex + 1];
	if (!next) return null;
	return queueItemToTrackInfo(next);
}

/**
 * Page cmd handlers + bridge for lyrics player reads/seeks.
 * Safe in world0 (no electron / preload).
 */
export const lyricsPage = definePageCmds({
	name: "lyrics",
	cmds: {
		trackInfo: () => readTrackInfoFromPlayer(),
		nextTrackInfo: () => readNextTrackInfoFromQueue(),
		currentTime: () => readCurrentTimeSec(),
		seek: (timeSec) => seekToSec(Number(timeSec) || 0),
	},
});

export const LYRICS_MSG = lyricsPage.type;
