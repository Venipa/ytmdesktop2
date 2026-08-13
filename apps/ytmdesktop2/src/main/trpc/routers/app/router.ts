import { fromIpcEvent } from "@main/trpc/fromIpcEvent";
import { serverMain } from "@main/ipc/serverEvents";
import { provider } from "@main/trpc/provider";
import { publicProcedure, router } from "@shared/trpc/trpc";
import IPC_EVENT_NAMES from "@shared/constants/eventNames";
import { BrowserWindow } from "electron";
import { z } from "zod";

const toastPayload = z.object({
	type: z.enum(["success", "info", "error"]).default("info"),
	message: z.string().min(1),
});

export type AppToastPayload = z.infer<typeof toastPayload>;

export const appServiceRouter = router({
	isWin11: publicProcedure.query(({ ctx }): Promise<boolean> => provider(ctx, "app").handleIsWin11()),
	version: publicProcedure.query(({ ctx }): string => provider(ctx, "app").app.getVersion()),
	openFile: publicProcedure.input(z.string()).mutation(({ ctx, input }) => provider(ctx, "app").handleOpenFile(null as unknown as Electron.IpcMainInvokeEvent, input)),
	openLogsFolder: publicProcedure.mutation(({ ctx }) => provider(ctx, "app").openLogsFolder()),
	minimize: publicProcedure.mutation(({ ctx }): void => {
		const window = ctx.getBrowserWindow();
		if (window?.isMinimizable?.()) window.minimize?.();
	}),
	maximize: publicProcedure.mutation(({ ctx }): void => {
		const window = ctx.getBrowserWindow();
		if (window?.isMaximizable?.()) window.isMaximized?.() ? window.unmaximize?.() : window.maximize?.();
	}),
	quit: publicProcedure.input(z.boolean().optional()).mutation(({ input }): void => {
		serverMain.emit("app.quit", null, input ?? false);
	}),
	openWindow: publicProcedure.input(z.string()).mutation(({ ctx, input }): Promise<void> => provider(ctx, "app").openSubWindow(input)),
	openSettings: publicProcedure.mutation(async ({ ctx }): Promise<boolean> => {
		await provider(ctx, "app").openSettingsWindow();
		return true;
	}),
	closeWindow: publicProcedure.input(z.string().optional()).mutation(({ ctx, input }): void => {
		if (input) {
			provider(ctx, "app").closeSubWindow(ctx.event as Electron.IpcMainEvent, input);
			return;
		}
		BrowserWindow.fromWebContents(ctx.event.sender as Electron.WebContents)?.close();
	}),
	restartNeeded: publicProcedure
		.input(
			z
				.object({
					message: z.string().optional(),
					icon: z.string().optional(),
					width: z.number().positive().optional(),
					height: z.number().positive().optional(),
				})
				.optional(),
		)
		.mutation(({ ctx, input }): Promise<void> => provider(ctx, "app").handleRestartNeeded(null, input ?? {})),
	onToast: publicProcedure.subscription(() => fromIpcEvent<AppToastPayload>(IPC_EVENT_NAMES.APP_TOAST)),
});
