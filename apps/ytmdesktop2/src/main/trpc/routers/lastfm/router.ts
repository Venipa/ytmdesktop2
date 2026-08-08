import { fromIpcEvent } from "@main/trpc/fromIpcEvent";
import { provider } from "@main/trpc/provider";
import IPC_EVENT_NAMES from "@shared/constants/eventNames";
import { publicProcedure, router } from "@shared/trpc/trpc";
import { z } from "zod";

export type LastFmStatus = {
	connected: boolean;
	name: string | null | undefined;
	error: boolean;
	processing: boolean;
};

export const lastfmRouter = router({
	status: publicProcedure.query(({ ctx }) => provider(ctx, "lastfm").handleLastFMState()),
	profile: publicProcedure.mutation(({ ctx }) => provider(ctx, "lastfm").handleLastFMProfile()),
	authorize: publicProcedure.mutation(({ ctx }) => provider(ctx, "lastfm").handleLastFMAuth()),
	reauth: publicProcedure.mutation(({ ctx }) => provider(ctx, "lastfm").handleLastFMReauth()),
	toggle: publicProcedure.input(z.boolean()).mutation(({ ctx, input }) => provider(ctx, "lastfm").handleLastFMToggle(null, input)),
	onStatus: publicProcedure.subscription(() => fromIpcEvent<LastFmStatus>(IPC_EVENT_NAMES.LAST_FM_STATUS)),
	onSubmitState: publicProcedure.subscription(() =>
		fromIpcEvent<"start" | "change" | boolean | null>(IPC_EVENT_NAMES.LAST_FM_SUBMIT_STATE),
	),
});
