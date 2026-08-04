import { fromIpcEvent } from "@main/trpc/fromIpcEvent";
import { provider } from "@shared/trpc/context";
import { publicProcedure, router } from "@shared/trpc/trpc";

export const windowRouter = router({
	state: publicProcedure.query(({ ctx }) => provider(ctx, "window").getWindowStateForSender(ctx.event.sender)),
	mainState: publicProcedure.query(({ ctx }) => provider(ctx, "window").getMainWindowState()),
	stayOnTop: publicProcedure.mutation(({ ctx }) => {
		const window = ctx.getBrowserWindow();
		if (!window || window.isDestroyed?.()) return false;
		const isOnTop = !window.isAlwaysOnTop?.();
		window.setAlwaysOnTop?.(!!isOnTop);
		return !!isOnTop;
	}),
	isStayOnTop: publicProcedure.query(({ ctx }) => {
		const window = ctx.getBrowserWindow();
		if (!window || window.isDestroyed?.()) return false;
		return !!window.isAlwaysOnTop?.();
	}),
	onState: publicProcedure.subscription(() => fromIpcEvent("windowState")),
	onMainState: publicProcedure.subscription(() => fromIpcEvent("mainWindowState")),
});
