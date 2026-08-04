import { fromIpcEvent } from "@main/trpc/fromIpcEvent";
import { provider } from "@main/trpc/provider";
import { resolveWindowDialogResponse } from "@main/windows/dialogResponse";
import { publicProcedure, router } from "@shared/trpc/trpc";
import { z } from "zod";

export const windowRouter = router({
	state: publicProcedure.query(({ ctx }) => provider(ctx, "window").getWindowStateForSender(ctx.event.sender as Electron.WebContents)),
	mainState: publicProcedure.query(({ ctx }) => provider(ctx, "window").getMainWindowState()),
	stayOnTop: publicProcedure.mutation(({ ctx }): boolean => {
		const window = ctx.getBrowserWindow();
		if (!window || window.isDestroyed?.()) return false;
		const isOnTop = !window.isAlwaysOnTop?.();
		window.setAlwaysOnTop?.(!!isOnTop);
		return !!isOnTop;
	}),
	isStayOnTop: publicProcedure.query(({ ctx }): boolean => {
		const window = ctx.getBrowserWindow();
		if (!window || window.isDestroyed?.()) return false;
		return !!window.isAlwaysOnTop?.();
	}),
	dialogResponse: publicProcedure.input(z.enum(["close", "ok"])).mutation(({ ctx, input }): boolean => {
		const sender = ctx.event.sender as { id?: number };
		if (typeof sender?.id !== "number") return false;
		return resolveWindowDialogResponse(sender.id, input);
	}),
	onState: publicProcedure.subscription(() => fromIpcEvent("windowState")),
	onMainState: publicProcedure.subscription(() => fromIpcEvent("mainWindowState")),
});
