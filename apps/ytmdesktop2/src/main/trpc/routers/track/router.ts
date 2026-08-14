import { getLifecycleContext } from "@main/lifecycle";
import { publicProcedure, router } from "@shared/trpc/trpc";
import { z } from "zod";
import { trackService } from "./service";

const seekInput = z.object({
	time: z.number(),
	type: z.enum(["seek"]).optional(),
});

export const trackRouter = router({
	current: publicProcedure.query(() => trackService.getTrackInformation()),
	state: publicProcedure.query(() => trackService.getTrackState()),
	accent: publicProcedure.query(() => trackService.getTrackAccent()),
	routes: publicProcedure.query(() => (getLifecycleContext().getProvider("api") as { getRoutes?: () => unknown[] })?.getRoutes?.() ?? []),
	like: publicProcedure.input(z.object({ liked: z.boolean() })).mutation(({ input }) => trackService.postTrackLike(input.liked)),
	dislike: publicProcedure.input(z.object({ disliked: z.boolean() })).mutation(({ input }) => trackService.postTrackDisLike(input.disliked)),
	next: publicProcedure.mutation(() => trackService.nextTrack()),
	prev: publicProcedure.mutation(() => trackService.prevTrack()),
	play: publicProcedure.mutation(() => trackService.playTrack()),
	pause: publicProcedure.mutation(() => trackService.pauseTrack()),
	togglePlay: publicProcedure.mutation(() => trackService.toggleTrackPlayback()),
	repeat: publicProcedure.mutation(() => trackService.repeatTrack()),
	shuffle: publicProcedure.mutation(() => trackService.shuffleTrack()),
	volume: publicProcedure.input(z.object({ volume: z.number().optional() }).optional()).mutation(({ input }) => trackService.volumeTrack(input ?? undefined)),
	volumeUp: publicProcedure.input(z.object({ amount: z.number().optional() }).optional()).mutation(({ input }) => trackService.volumeUpTrack(input ?? undefined)),
	volumeDown: publicProcedure.input(z.object({ amount: z.number().optional() }).optional()).mutation(({ input }) => trackService.volumeDownTrack(input ?? undefined)),
	forward: publicProcedure.input(z.object({ time: z.number() })).mutation(({ input }) => trackService.forwardTrack(undefined, input)),
	backward: publicProcedure.input(z.object({ time: z.number() })).mutation(({ input }) => trackService.backwardTrack(undefined, input)),
	seek: publicProcedure.input(seekInput).mutation(({ input }) => trackService.seekTrack(undefined, input)),
	onTrack: publicProcedure.subscription(() => trackService.subscribeTrack()),
	onPlayState: publicProcedure.subscription(() => trackService.subscribePlayState()),
});
