import { fromIpcEvent } from "@main/trpc/fromIpcEvent";
import { provider } from "@main/trpc/provider";
import IPC_EVENT_NAMES from "@shared/constants/eventNames";
import { publicProcedure, router } from "@shared/trpc/trpc";
import type { UpdateInfo } from "@shared/utils/updater";
import { z } from "zod";

type UpdateSvc = {
	getUpdate(): Promise<UpdateInfo | null>;
	isUpdateDownloaded(): Promise<boolean>;
	onCheckUpdate(): Promise<unknown>;
	onAutoUpdateRun(ev: unknown, quitAndInstall?: boolean): Promise<boolean>;
};

export const updateRouter = router({
	get: publicProcedure.query(({ ctx }): Promise<UpdateInfo | null> => provider<UpdateSvc>(ctx, "update").getUpdate()),
	downloaded: publicProcedure.query(({ ctx }): Promise<boolean> => provider<UpdateSvc>(ctx, "update").isUpdateDownloaded()),
	check: publicProcedure.mutation(({ ctx }): Promise<unknown> => provider<UpdateSvc>(ctx, "update").onCheckUpdate()),
	install: publicProcedure
		.input(z.boolean().optional())
		.mutation(({ ctx, input }): Promise<boolean> => provider<UpdateSvc>(ctx, "update").onAutoUpdateRun(null, input ?? true)),
	onUpdate: publicProcedure.subscription(() => fromIpcEvent(IPC_EVENT_NAMES.APP_UPDATE)),
	onChecking: publicProcedure.subscription(() => fromIpcEvent<boolean>(IPC_EVENT_NAMES.APP_UPDATE_CHECKING)),
	onProgress: publicProcedure.subscription(() => fromIpcEvent(IPC_EVENT_NAMES.APP_UPDATE_PROGRESS)),
	onDownloaded: publicProcedure.subscription(() => fromIpcEvent(IPC_EVENT_NAMES.APP_UPDATE_DOWNLOADED)),
});
