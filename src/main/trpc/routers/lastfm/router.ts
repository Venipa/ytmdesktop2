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

type LastFmSvc = {
	handleLastFMState(): Promise<LastFmStatus>;
	handleLastFMProfile(): Promise<unknown>;
	handleLastFMAuth(): Promise<boolean>;
	handleLastFMToggle(ev: unknown, state: boolean): Promise<LastFmStatus | unknown>;
};

export const lastfmRouter = router({
	status: publicProcedure.query(({ ctx }): Promise<LastFmStatus> => provider<LastFmSvc>(ctx, "lastfm").handleLastFMState()),
	profile: publicProcedure.mutation(({ ctx }): Promise<unknown> => provider<LastFmSvc>(ctx, "lastfm").handleLastFMProfile()),
	authorize: publicProcedure.mutation(({ ctx }): Promise<boolean> => provider<LastFmSvc>(ctx, "lastfm").handleLastFMAuth()),
	toggle: publicProcedure.input(z.boolean()).mutation(({ ctx, input }): Promise<LastFmStatus | unknown> => provider<LastFmSvc>(ctx, "lastfm").handleLastFMToggle(null, input)),
	onStatus: publicProcedure.subscription(() => fromIpcEvent<LastFmStatus>(IPC_EVENT_NAMES.LAST_FM_STATUS)),
	onSubmitState: publicProcedure.subscription(() =>
		fromIpcEvent<"start" | "change" | boolean | null>(IPC_EVENT_NAMES.LAST_FM_SUBMIT_STATE),
	),
});
