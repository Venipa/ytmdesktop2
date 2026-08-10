import { provider } from "@main/trpc/provider";
import { publicProcedure, router } from "@shared/trpc/trpc";
import { z } from "zod";

export const updateRouter = router({
	get: publicProcedure.query(({ ctx }) => provider(ctx, "update").getUpdate()),
	downloaded: publicProcedure.query(({ ctx }) => provider(ctx, "update").isUpdateDownloaded()),
	progress: publicProcedure.query(({ ctx }) => provider(ctx, "update").getProgress()),
	checking: publicProcedure.query(({ ctx }) => provider(ctx, "update").isChecking()),
	check: publicProcedure
		.input(z.object({ showDialog: z.boolean().optional() }).optional())
		.mutation(({ ctx, input }) =>
			provider(ctx, "update").onCheckUpdate({
				showDialog: input?.showDialog ?? true,
				// User-initiated checks always reopen the dialog, even after "Later".
				forceDialog: true,
			}),
		),
	install: publicProcedure
		.input(z.boolean().optional())
		.mutation(({ ctx, input }) => provider(ctx, "update").onAutoUpdateRun(null, input ?? true)),
	cancel: publicProcedure.mutation(({ ctx }) => provider(ctx, "update").onDownloadUpdateCancel()),
	dismiss: publicProcedure.mutation(({ ctx }) => provider(ctx, "update").dismissUpdateDialog()),
	onUpdate: publicProcedure.subscription(({ ctx }) => provider(ctx, "update").subscribeUpdate()),
	onChecking: publicProcedure.subscription(({ ctx }) => provider(ctx, "update").subscribeChecking()),
	onProgress: publicProcedure.subscription(({ ctx }) => provider(ctx, "update").subscribeProgress()),
	onDownloaded: publicProcedure.subscription(({ ctx }) => provider(ctx, "update").subscribeDownloaded()),
});
