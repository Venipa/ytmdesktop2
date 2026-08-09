import type { TrackData } from "./trackData";

export function relatedVideoIds(track: TrackData): string[] {
	const ids: string[] = [];
	const videoId = track.video?.videoId;
	if (videoId) ids.push(String(videoId));
	const counterpart = track.meta?.counterpartVideoId;
	if (counterpart) ids.push(String(counterpart));
	return ids;
}

export function relatedIdsIntersect(a: TrackData, b: TrackData): boolean {
	const bSet = new Set(relatedVideoIds(b));
	return relatedVideoIds(a).some((id) => bSet.has(id));
}

/** Prefer cached ATV counterpart for Last.fm when playing the music video. */
export function preferLastFmTrack(
	track: TrackData,
	findById: (id: string) => TrackData | undefined,
	cloneTrack: <T>(value: T) => T,
): TrackData {
	if (track.meta.isAudioExclusive) return track;
	const counterpartId = track.meta.counterpartVideoId;
	if (!counterpartId) return track;
	const cached = findById(counterpartId);
	if (!cached?.meta?.isAudioExclusive || !cached.video?.videoId) return track;
	const preferred = cloneTrack(cached);
	preferred.meta.startedAt = track.meta.startedAt;
	preferred.meta.counterpartVideoId = track.video.videoId;
	return preferred;
}

export type LastFmSessionDecision =
	| { type: "new-session"; preferred: TrackData; relatedIds: string[] }
	| { type: "upgrade-atv"; preferred: TrackData; relatedIds: string[] }
	| { type: "same-session-keep"; relatedIds: string[] }
	| { type: "same-session-settled"; relatedIds: string[] };

/**
 * Pure Song↔Video Last.fm session decision (one listen per counterpart pair; prefer ATV).
 */
export function decideLastFmSession(args: {
	track: TrackData;
	lastRelatedIds: ReadonlySet<string>;
	pending: { track: TrackData; relatedIds: ReadonlySet<string> } | null;
	findById: (id: string) => TrackData | undefined;
	cloneTrack: <T>(value: T) => T;
}): LastFmSessionDecision {
	const relatedIds = relatedVideoIds(args.track);
	const preferred = preferLastFmTrack(args.track, args.findById, args.cloneTrack);
	const sameSession = relatedIds.some((id) => args.lastRelatedIds.has(id));

	if (!sameSession) {
		return { type: "new-session", preferred, relatedIds };
	}

	if (!args.pending) {
		return { type: "same-session-settled", relatedIds };
	}

	const incomingIsAudio = !!preferred.meta.isAudioExclusive;
	const pendingIsAudio = !!args.pending.track.meta.isAudioExclusive;
	if (incomingIsAudio && !pendingIsAudio) {
		return { type: "upgrade-atv", preferred, relatedIds };
	}

	return { type: "same-session-keep", relatedIds };
}

export function trackNeedsLastFmPush(args: {
	track: TrackData;
	lastRelatedIds: ReadonlySet<string>;
	pending: { track: TrackData } | null;
	findById: (id: string) => TrackData | undefined;
	cloneTrack: <T>(value: T) => T;
}): boolean {
	const related = relatedVideoIds(args.track);
	const inSession = related.some((id) => args.lastRelatedIds.has(id));
	if (!inSession) return true;
	if (related.some((id) => !args.lastRelatedIds.has(id))) return true;
	const preferred = preferLastFmTrack(args.track, args.findById, args.cloneTrack);
	if (preferred.meta.isAudioExclusive && args.pending && !args.pending.track.meta.isAudioExclusive) {
		return true;
	}
	return false;
}

/** Last.fm drops idle Now Playing — refresh after this pause on resume. */
export const LASTFM_NP_REFRESH_AFTER_PAUSE_MS = 90_000;
export const LASTFM_SCROBBLE_MIN_DURATION_SEC = 30;
export const LASTFM_SCROBBLE_MAX_WAIT_SEC = 240;

/** True when pause was long enough that Last.fm likely cleared Now Playing. */
export function shouldRefreshLastFmNowPlaying(
	pausedMs: number,
	thresholdMs: number = LASTFM_NP_REFRESH_AFTER_PAUSE_MS,
): boolean {
	return Number.isFinite(pausedMs) && pausedMs >= thresholdMs;
}

/**
 * Remaining wait until scrobble threshold from current elapsed.
 * Null = track too short; 0 = already at/past threshold.
 */
export function lastFmScrobbleRemainingMs(
	durationSec: number,
	elapsedSec: number = 0,
	minDurationSec: number = LASTFM_SCROBBLE_MIN_DURATION_SEC,
	maxHalfSec: number = LASTFM_SCROBBLE_MAX_WAIT_SEC,
): number | null {
	if (!Number.isFinite(durationSec) || durationSec < minDurationSec) return null;
	const thresholdSec = Math.min(durationSec * 0.5, maxHalfSec);
	const elapsed = Number.isFinite(elapsedSec) ? Math.max(0, elapsedSec) : 0;
	if (elapsed >= thresholdSec) return 0;
	return (thresholdSec - elapsed) * 1000;
}

/** Listen identity for Last.fm NP/scrobble dedupe (epoch = unique loop listens). */
export function lastFmListenKey(videoId: string, startedAt: number, epoch?: number): string {
	const base = `${videoId}:${Math.floor(startedAt)}`;
	return epoch != null ? `${base}:${epoch}` : base;
}
