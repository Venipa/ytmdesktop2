import { fromIpcEvent } from "@main/trpc/fromIpcEvent";
import { provider } from "@main/trpc/provider";
import { publicProcedure, router } from "@shared/trpc/trpc";

type NavigationSvc = {
	goHome(): Promise<void>;
	toggleDevTools(): void;
};

type WindowNavSvc = {
	views: {
		youtubeView?: {
			webContents?: {
				isDestroyed(): boolean;
				navigationHistory: {
					canGoBack(): boolean;
					goBack(): void;
				};
			};
		};
	};
};

export const navigationRouter = router({
	home: publicProcedure.mutation(({ ctx }): Promise<void> => provider<NavigationSvc>(ctx, "navigation").goHome()),
	goback: publicProcedure.mutation(({ ctx }): void => {
		const contents = provider<WindowNavSvc>(ctx, "window").views.youtubeView?.webContents;
		if (!contents || contents.isDestroyed() || !contents.navigationHistory.canGoBack()) return;
		contents.navigationHistory.goBack();
	}),
	devTools: publicProcedure.mutation(({ ctx }): void => provider<NavigationSvc>(ctx, "navigation").toggleDevTools()),
	onSameOrigin: publicProcedure.subscription(() => fromIpcEvent<boolean>("nav.same-origin")),
});
