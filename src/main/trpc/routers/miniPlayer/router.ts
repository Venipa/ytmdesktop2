import { fromIpcEvent } from "@main/trpc/fromIpcEvent";
import { providerByKey } from "@main/trpc/provider";
import { publicProcedure, router } from "@shared/trpc/trpc";

type MiniPlayerSvc = { openMiniPlayer(): Promise<unknown> };

export const miniplayerRouter = router({
	open: publicProcedure.mutation(({ ctx }): Promise<unknown> => providerByKey<MiniPlayerSvc>(ctx, "mp").openMiniPlayer()),
	onState: publicProcedure.subscription(() => fromIpcEvent<{ active?: boolean } | null>("miniplayer.state")),
});
