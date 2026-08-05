import type { AppRouter } from "@main/trpc/router";
import type { TrackData } from "@shared/track/trackData";
import type { inferRouterOutputs } from "@trpc/server";
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";

export type TrackState = NonNullable<inferRouterOutputs<AppRouter>["track"]["state"]>;

export type TrackProgress = {
	playing: boolean;
	progress: number;
	duration: number;
	percentage: number;
	eventType: TrackState["eventType"] | null;
};

function sameTrack(a: TrackData | null, b: TrackData | null): boolean {
	if (a === b) return true;
	if (!a || !b) return false;
	return a.video.videoId === b.video.videoId && a.video.title === b.video.title && a.music?.album === b.music?.album;
}

function sameState(a: TrackState | null, b: TrackState | null): boolean {
	if (a === b) return true;
	if (!a || !b) return false;
	return (
		a.id === b.id &&
		a.playing === b.playing &&
		Math.floor(a.progress * 4) === Math.floor(b.progress * 4) &&
		a.liked === b.liked &&
		a.disliked === b.disliked &&
		a.accent === b.accent &&
		a.eventType === b.eventType &&
		Math.floor(a.duration) === Math.floor(b.duration)
	);
}

/**
 * Current track metadata (title, artists, thumbnails, …).
 */
export function useTrack() {
	const [track, setTrack] = useState<TrackData | null>(null);

	trpc.track.current.useQuery(undefined, {
		onSuccess: (next) => {
			const value = (next as TrackData | null) ?? null;
			setTrack((prev) => (sameTrack(prev, value) ? prev : value));
		},
	});
	trpc.track.onTrack.useSubscription(undefined, {
		onData: (next) => {
			const value = (next as TrackData | null) ?? null;
			setTrack((prev) => (sameTrack(prev, value) ? prev : value));
		},
	});

	return track;
}

/**
 * Full playback state (liked, progress, duration, accent, …).
 */
export function useTrackState() {
	const [state, setState] = useState<TrackState | null>(null);

	trpc.track.state.useQuery(undefined, {
		onSuccess: (next) => {
			if (!next) return;
			const value = next as TrackState;
			setState((prev) => (sameState(prev, value) ? prev : value));
		},
	});
	trpc.track.onPlayState.useSubscription(undefined, {
		onData: (next) => {
			if (!next) return;
			const value = next as TrackState;
			setState((prev) => (sameState(prev, value) ? prev : value));
		},
	});

	return state;
}

/**
 * Slim progress slice: progress + playing (+ duration / percentage).
 */
export function useTrackProgress(): TrackProgress {
	const state = useTrackState();

	return useMemo(
		(): TrackProgress => ({
			playing: !!state?.playing,
			progress: state?.progress ?? 0,
			duration: state?.duration ?? 0,
			percentage: state?.percentage ?? 0,
			eventType: state?.eventType ?? null,
		}),
		[state?.playing, state?.progress, state?.duration, state?.percentage, state?.eventType],
	);
}
