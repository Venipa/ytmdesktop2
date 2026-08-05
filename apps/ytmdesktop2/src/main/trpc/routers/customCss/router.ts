import { provider } from "@main/trpc/provider";
import { publicProcedure, router } from "@shared/trpc/trpc";

export const customCssRouter = router({
	reload: publicProcedure.mutation(({ ctx }) => provider(ctx, "customCss").requestUpdate()),
});
