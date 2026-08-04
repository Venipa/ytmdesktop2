import { provider } from "@shared/trpc/context";
import { publicProcedure, router } from "@shared/trpc/trpc";
import { z } from "zod";

export const appServiceRouter = router({
	isWin11: publicProcedure.query(({ ctx }) => provider(ctx, "app").handleIsWin11()),
	openFile: publicProcedure.input(z.string()).mutation(({ ctx, input }) => provider(ctx, "app").handleOpenFile(null, input)),
	minimize: publicProcedure.mutation(({ ctx }) => {
		const window = ctx.getBrowserWindow();
		if (window?.isMinimizable?.()) window.minimize?.();
	}),
	maximize: publicProcedure.mutation(({ ctx }) => {
		const window = ctx.getBrowserWindow();
		if (window?.isMaximizable?.()) window.isMaximized?.() ? window.unmaximize?.() : window.maximize?.();
	}),
});
