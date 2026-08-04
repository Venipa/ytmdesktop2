import { fromIpcEvent } from "@main/trpc/fromIpcEvent";
import { providerByKey } from "@shared/trpc/context";
import { publicProcedure, router } from "@shared/trpc/trpc";

export const miniplayerRouter = router({
	open: publicProcedure.mutation(({ ctx }) => providerByKey(ctx, "mp").openMiniPlayer()),
	onState: publicProcedure.subscription(() => fromIpcEvent<{ active?: boolean } | null>("miniplayer.state")),
});
