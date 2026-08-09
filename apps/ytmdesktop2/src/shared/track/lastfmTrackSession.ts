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

/** Tracks shorter than this never scrobble / never count as loop re-listen. */
export const LASTFM_RELISTEN_MIN_DURATION_SEC = 30;
/** Max wall progress that still counts as “near start” after a wrap (also duration*5%). */
export const LASTFM_RELISTEN_NEAR_START_SEC = 3;
/** Min drop (sec) so chatter / tiny seeks do not look like a loop. */
export const LASTFM_RELISTEN_MIN_DROP_SEC = 10;
/** Within this many seconds of duration end counts as “far enough” even before half. */
export const LASTFM_RELISTEN_NEAR_END_SEC = 8;
/** Same half-or-4min ceiling as Last.fm scrobble threshold. */
export const LASTFM_RELISTEN_MAX_HALF_SEC = 240;

/** True when pause was long enough that Last.fm likely cleared Now Playing. */
export function shouldRefreshLastFmNowPlaying(
	pausedMs: number,
	thresholdMs: number = LASTFM_NP_REFRESH_AFTER_PAUSE_MS,
): boolean {
	return Number.isFinite(pausedMs) && pausedMs >= thresholdMs;
}

/**
 * Same-track loop / restart: progress jumped from past scrobble (or near end) to near start.
 * Mid-track seeks (e.g. 50% → 10%) stay false.
 */
export function isLastFmProgressRelisten(
	prevProgressSec: number,
	nextProgressSec: number,
	durationSec: number,
): boolean {
	if (!Number.isFinite(prevProgressSec) || !Number.isFinite(nextProgressSec) || !Number.isFinite(durationSec)) {
		return false;
	}
	if (durationSec < LASTFM_RELISTEN_MIN_DURATION_SEC) return false;
	const nearStartMax = Math.max(LASTFM_RELISTEN_NEAR_START_SEC, durationSec * 0.05);
	if (nextProgressSec >= nearStartMax) return false;
	if (prevProgressSec - nextProgressSec < LASTFM_RELISTEN_MIN_DROP_SEC) return false;
	const scrobbleFarEnough = prevProgressSec >= Math.min(durationSec * 0.5, LASTFM_RELISTEN_MAX_HALF_SEC);
	const nearEnd = prevProgressSec >= durationSec - LASTFM_RELISTEN_NEAR_END_SEC;
	return scrobbleFarEnough || nearEnd;
}

/** Listen identity for Last.fm NP/scrobble dedupe (same video can re-listen). */
export function lastFmListenKey(videoId: string, startedAt: number): string {
	return `${videoId}:${Math.floor(startedAt)}`;
}
