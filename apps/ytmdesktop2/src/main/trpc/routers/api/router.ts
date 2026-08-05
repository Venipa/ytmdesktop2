import type { AuthClientRecord } from "@main/auth";
import { provider } from "@main/trpc/provider";
import { publicProcedure, router } from "@shared/trpc/trpc";

export const apiRouter = router({
	status: publicProcedure.query(({ ctx }) => {
		const api = provider(ctx, "api");
		const settings = provider(ctx, "settings").instance.api;
		return {
			enabled: settings?.enabled === true,
			port: settings?.port ?? 13091,
			authRequired: settings?.authRequired === true,
			running: api.isInitialized,
		};
	}),
});

export type { AuthClientRecord };
