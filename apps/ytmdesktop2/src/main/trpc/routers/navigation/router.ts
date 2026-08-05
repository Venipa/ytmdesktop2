import { fromIpcEvent } from "@main/trpc/fromIpcEvent";
import { provider } from "@main/trpc/provider";
import { publicProcedure, router } from "@shared/trpc/trpc";

export const navigationRouter = router({
	home: publicProcedure.mutation(({ ctx }) => provider(ctx, "navigation").goHome()),
	goback: publicProcedure.mutation(({ ctx }): void => {
		const contents = provider(ctx, "window").views.youtubeView?.webContents;
		if (!contents || contents.isDestroyed() || !contents.navigationHistory.canGoBack()) return;
		contents.navigationHistory.goBack();
	}),
	devTools: publicProcedure.mutation(({ ctx }): void => provider(ctx, "navigation").toggleDevTools()),
	onSameOrigin: publicProcedure.subscription(() => fromIpcEvent<boolean>("nav.same-origin")),
});
