import { provider } from "@main/trpc/provider";
import { publicProcedure, router } from "@shared/trpc/trpc";
import { listThemes } from "./registry";

export const themesRouter = router({
	list: publicProcedure.query(() => listThemes()),
	reload: publicProcedure.mutation(({ ctx }) => provider(ctx, "themes").requestUpdate()),
});
