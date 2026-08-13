import { fromIpcEvent } from "@main/trpc/fromIpcEvent";
import { provider } from "@main/trpc/provider";
import { publicProcedure, router } from "@shared/trpc/trpc";

export type TrayViewState = { active?: boolean; pinned?: boolean };

export const trayViewRouter = router({
	toggle: publicProcedure.mutation(({ ctx }) => provider(ctx, "trayView").toggle()),
	open: publicProcedure.mutation(({ ctx }) => provider(ctx, "trayView").open()),
	hide: publicProcedure.mutation(({ ctx }) => provider(ctx, "trayView").hide()),
	openMain: publicProcedure.mutation(({ ctx }) => provider(ctx, "trayView").openMain()),
	togglePinned: publicProcedure.mutation(({ ctx }) => provider(ctx, "trayView").togglePinned()),
	pinned: publicProcedure.query(({ ctx }) => provider(ctx, "trayView").isPinned()),
	onState: publicProcedure.subscription(() => fromIpcEvent<TrayViewState | null>("trayview.state")),
});
