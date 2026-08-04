import { provider } from "@main/trpc/provider";
import { publicProcedure, router } from "@shared/trpc/trpc";

type CustomCssSvc = { requestUpdate(): Promise<unknown> | unknown };

export const customCssRouter = router({
	reload: publicProcedure.mutation(({ ctx }): Promise<unknown> | unknown => provider<CustomCssSvc>(ctx, "customCss").requestUpdate()),
});
