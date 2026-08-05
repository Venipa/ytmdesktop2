import type { ServiceTypeMap } from "@main/contracts/services.generated";
import type { AppTrpcContext } from "@shared/trpc/context";

export function provider<TKey extends keyof ServiceTypeMap & ({} & string)>(ctx: AppTrpcContext, name: TKey): ServiceTypeMap[TKey] {
	return ctx.getProvider(name) as ServiceTypeMap[TKey];
}
