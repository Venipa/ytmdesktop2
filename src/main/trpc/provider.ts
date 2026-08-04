import type { ServiceTypeMap } from "@main/contracts/services.generated";
import type { AppTrpcContext } from "@shared/trpc/context";

export function provider<TKey extends keyof ServiceTypeMap & ({} & string), T extends ServiceTypeMap[TKey]>(ctx: AppTrpcContext, name: TKey): T {
	return ctx.getProvider(name) as T;
}

export function providerByKey<TKey extends keyof ServiceTypeMap, T extends ServiceTypeMap[TKey]>(ctx: AppTrpcContext, name: TKey): T {
	return ctx.getProvider(name) as T;
}
