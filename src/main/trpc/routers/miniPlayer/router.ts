import { fromIpcEvent } from "@main/trpc/fromIpcEvent";
import { provider } from "@main/trpc/provider";
import { publicProcedure, router } from "@shared/trpc/trpc";

export const miniplayerRouter = router({
	open: publicProcedure.mutation(({ ctx }) => provider(ctx, "miniPlayer").openMiniPlayer()),
	onState: publicProcedure.subscription(() => fromIpcEvent<{ active?: boolean } | null>("miniplayer.state")),
});
