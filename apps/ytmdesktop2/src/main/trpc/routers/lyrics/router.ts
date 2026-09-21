import { fromIpcEvent } from "@main/trpc/fromIpcEvent";
import { provider } from "@main/trpc/provider";
import {
	LYRICS_OVERLAY_EVENTS,
	type LyricsOverlayClock,
	type LyricsOverlaySnapshot,
	type LyricsOverlayWindowState,
} from "@shared/lyrics/overlay";
import { publicProcedure, router } from "@shared/trpc/trpc";
import { z } from "zod";

export const lyricsRouter = router({
	overlaySnapshot: publicProcedure.query(({ ctx }): LyricsOverlaySnapshot => provider(ctx, "lyrics").getOverlaySnapshot()),
	overlayClock: publicProcedure.query(({ ctx }): LyricsOverlayClock | null => provider(ctx, "lyrics").getOverlayClock()),
	overlayState: publicProcedure.query(({ ctx }): LyricsOverlayWindowState => provider(ctx, "lyrics").getOverlayState()),
	setOverlayEnabled: publicProcedure.input(z.boolean()).mutation(({ ctx, input }): boolean => provider(ctx, "lyrics").setOverlayEnabled(input)),
	toggleOverlay: publicProcedure.mutation(({ ctx }): boolean => provider(ctx, "lyrics").toggleOverlay()),
	setOverlayLocked: publicProcedure.input(z.boolean()).mutation(({ ctx, input }): boolean => provider(ctx, "lyrics").setOverlayLocked(input)),
	toggleOverlayLocked: publicProcedure.mutation(({ ctx }): boolean => provider(ctx, "lyrics").toggleOverlayLocked()),
	resetOverlayPosition: publicProcedure.mutation(({ ctx }): void => provider(ctx, "lyrics").resetOverlayPosition()),
	onOverlaySnapshot: publicProcedure.subscription(() => fromIpcEvent<LyricsOverlaySnapshot>(LYRICS_OVERLAY_EVENTS.snapshot)),
	onOverlayClock: publicProcedure.subscription(() => fromIpcEvent<LyricsOverlayClock>(LYRICS_OVERLAY_EVENTS.clock)),
	onOverlayState: publicProcedure.subscription(() => fromIpcEvent<LyricsOverlayWindowState>(LYRICS_OVERLAY_EVENTS.state)),
});
