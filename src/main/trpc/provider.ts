import type { AppTrpcContext } from "@shared/trpc/context";

/** Cast helper — pass service class type: `provider<AppProvider>(ctx, "app")`. */
export function provider<T>(ctx: AppTrpcContext, name: string): T {
	return ctx.getProvider(name) as T;
}

export function providerByKey<T>(ctx: AppTrpcContext, name: string): T {
	return ctx.getProvider(name) as T;
}
