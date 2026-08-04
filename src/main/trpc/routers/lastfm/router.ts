import { fromIpcEvent } from "@main/trpc/fromIpcEvent";
import IPC_EVENT_NAMES from "@shared/constants/eventNames";
import { provider } from "@shared/trpc/context";
import { publicProcedure, router } from "@shared/trpc/trpc";
import { z } from "zod";

export const lastfmRouter = router({
	status: publicProcedure.query(({ ctx }) => provider(ctx, "lastfm").handleLastFMState()),
	profile: publicProcedure.mutation(({ ctx }) => provider(ctx, "lastfm").handleLastFMProfile()),
	authorize: publicProcedure.mutation(({ ctx }) => provider(ctx, "lastfm").handleLastFMAuth()),
	toggle: publicProcedure.input(z.boolean()).mutation(({ ctx, input }) => provider(ctx, "lastfm").handleLastFMToggle(null, input)),
	onStatus: publicProcedure.subscription(() => fromIpcEvent(IPC_EVENT_NAMES.LAST_FM_STATUS)),
	onSubmitState: publicProcedure.subscription(() =>
		fromIpcEvent<"start" | "change" | boolean | null>(IPC_EVENT_NAMES.LAST_FM_SUBMIT_STATE),
	),
});
