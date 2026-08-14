import { trpc } from "@/lib/trpc";
import type { AppRouter } from "@main/trpc/router";
import type { inferRouterOutputs } from "@trpc/server";
import { isEqual, pick } from "lodash-es";
import { useMemo } from "react";

export type TrackState = NonNullable<inferRouterOutputs<AppRouter>["track"]["state"]>;
export type CurrentTrack = inferRouterOutputs<AppRouter>["track"]["current"];

export type TrackProgress = {
	playing: boolean;
	progress: number;
	duration: number;
	percentage: number;
	eventType: TrackState["eventType"] | null;
};
const compareProps = ["video.videoId", "video.title", "music.album", "meta.liked", "meta.disliked"] as const;
function sameTrack(a: CurrentTrack, b: CurrentTrack): boolean {
	if (a === b) return true;
	if (!a || !b) return false;
	return isEqual(pick(a, compareProps), pick(b, compareProps));
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
	const utils = trpc.useUtils();
	const { data } = trpc.track.current.useQuery();

	trpc.track.onTrack.useSubscription(undefined, {
		onData: (next) => {
			const value = (next as CurrentTrack) ?? null;
			const prev = utils.track.current.getData() ?? null;
			if (sameTrack(prev, value)) return;
			utils.track.current.setData(undefined, value);
		},
	});

	return data ?? null;
}

/**
 * Full playback state (liked, progress, duration, accent, …).
 */
export function useTrackState() {
	const utils = trpc.useUtils();
	const { data } = trpc.track.state.useQuery();

	trpc.track.onPlayState.useSubscription(undefined, {
		onData: (next) => {
			if (!next) return;
			const value = next as TrackState;
			const prev = (utils.track.state.getData() as TrackState | null) ?? null;
			if (sameState(prev, value)) return;
			utils.track.state.setData(undefined, value);
		},
	});

	return (data as TrackState | null) ?? null;
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
