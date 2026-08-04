import { provider } from "@main/trpc/provider";
import { publicProcedure, router } from "@shared/trpc/trpc";

type TraySvc = { openTaskView(): Promise<unknown> };

export const trayRouter = router({
	taskView: publicProcedure.mutation(({ ctx }): Promise<unknown> => provider<TraySvc>(ctx, "tray").openTaskView()),
});
