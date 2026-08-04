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

/**
 * Current track metadata (title, artists, thumbnails, …).
 */
export function useTrack() {
	const [track, setTrack] = useState<TrackData | null>(null);

	trpc.track.current.useQuery(undefined, {
		onSuccess: (next) => setTrack((next as TrackData | null) ?? null),
	});
	trpc.track.onTrack.useSubscription(undefined, {
		onData: (next) => setTrack((next as TrackData | null) ?? null),
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
			if (next) setState(next as TrackState);
		},
	});
	trpc.track.onPlayState.useSubscription(undefined, {
		onData: (next) => {
			if (next) setState(next as TrackState);
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
