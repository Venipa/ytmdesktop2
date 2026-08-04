import { fromIpcEvent } from "@main/trpc/fromIpcEvent";
import IPC_EVENT_NAMES from "@shared/constants/eventNames";
import { provider } from "@shared/trpc/context";
import { publicProcedure, router } from "@shared/trpc/trpc";
import { z } from "zod";

export const updateRouter = router({
	get: publicProcedure.query(({ ctx }) => provider(ctx, "update").getUpdate()),
	downloaded: publicProcedure.query(({ ctx }) => provider(ctx, "update").isUpdateDownloaded()),
	check: publicProcedure.mutation(({ ctx }) => provider(ctx, "update").onCheckUpdate()),
	install: publicProcedure
		.input(z.boolean().optional())
		.mutation(({ ctx, input }) => provider(ctx, "update").onAutoUpdateRun(null, input ?? true)),
	onUpdate: publicProcedure.subscription(() => fromIpcEvent(IPC_EVENT_NAMES.APP_UPDATE)),
	onChecking: publicProcedure.subscription(() => fromIpcEvent<boolean>(IPC_EVENT_NAMES.APP_UPDATE_CHECKING)),
	onProgress: publicProcedure.subscription(() => fromIpcEvent(IPC_EVENT_NAMES.APP_UPDATE_PROGRESS)),
	onDownloaded: publicProcedure.subscription(() => fromIpcEvent(IPC_EVENT_NAMES.APP_UPDATE_DOWNLOADED)),
});
