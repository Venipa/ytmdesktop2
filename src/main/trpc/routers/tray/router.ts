import { provider } from "@shared/trpc/context";
import { publicProcedure, router } from "@shared/trpc/trpc";

export const trayRouter = router({
	taskView: publicProcedure.mutation(({ ctx }) => provider(ctx, "tray").openTaskView()),
});
