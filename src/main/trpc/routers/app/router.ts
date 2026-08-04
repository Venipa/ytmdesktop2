import { serverMain } from "@main/ipc/serverEvents";
import { provider } from "@main/trpc/provider";
import { publicProcedure, router } from "@shared/trpc/trpc";
import { BrowserWindow } from "electron";
import { z } from "zod";

type AppSvc = {
	handleIsWin11(): Promise<boolean>;
	app: { getVersion(): string };
	handleOpenFile(ev: unknown, path: string): Promise<unknown>;
	openSubWindow(windowName: string): Promise<void>;
	openSettingsWindow(): Promise<unknown>;
	closeSubWindow(ev: unknown, windowName?: string): void;
	handleRestartNeeded(ev: unknown, opts?: { message?: string; icon?: string }): Promise<void>;
};

export const appServiceRouter = router({
	isWin11: publicProcedure.query(({ ctx }): Promise<boolean> => provider<AppSvc>(ctx, "app").handleIsWin11()),
	version: publicProcedure.query(({ ctx }): string => provider<AppSvc>(ctx, "app").app.getVersion()),
	openFile: publicProcedure.input(z.string()).mutation(({ ctx, input }): Promise<unknown> => provider<AppSvc>(ctx, "app").handleOpenFile(null, input)),
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
	openWindow: publicProcedure.input(z.string()).mutation(({ ctx, input }): Promise<void> => provider<AppSvc>(ctx, "app").openSubWindow(input)),
	openSettings: publicProcedure.mutation(({ ctx }): Promise<unknown> => provider<AppSvc>(ctx, "app").openSettingsWindow()),
	closeWindow: publicProcedure.input(z.string().optional()).mutation(({ ctx, input }): void => {
		if (input) {
			provider<AppSvc>(ctx, "app").closeSubWindow(ctx.event, input);
			return;
		}
		BrowserWindow.fromWebContents(ctx.event.sender as Electron.WebContents)?.close();
	}),
	restartNeeded: publicProcedure
		.input(z.object({ message: z.string().optional(), icon: z.string().optional() }).optional())
		.mutation(({ ctx, input }): Promise<void> => provider<AppSvc>(ctx, "app").handleRestartNeeded(null, input ?? {})),
});
