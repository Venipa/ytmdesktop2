import { serverMain } from "@main/ipc/serverEvents";
import { provider } from "@main/trpc/provider";
import { publicProcedure, router } from "@shared/trpc/trpc";
import { BrowserWindow } from "electron";
import { z } from "zod";

export const appServiceRouter = router({
	isWin11: publicProcedure.query(({ ctx }): Promise<boolean> => provider(ctx, "app").handleIsWin11()),
	version: publicProcedure.query(({ ctx }): string => provider(ctx, "app").app.getVersion()),
	openFile: publicProcedure.input(z.string()).mutation(({ ctx, input }) => provider(ctx, "app").handleOpenFile(null as unknown as Electron.IpcMainInvokeEvent, input)),
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
	openSettings: publicProcedure.mutation(({ ctx }): Promise<unknown> => provider(ctx, "app").openSettingsWindow()),
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
});
