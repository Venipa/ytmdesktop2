import { provider } from "@main/trpc/provider";
import { publicProcedure, router } from "@shared/trpc/trpc";
import { z } from "zod";

export const shortcutRouter = router({
	list: publicProcedure.query(({ ctx }) => provider(ctx, "shortcut").list()),
	set: publicProcedure
		.input(z.object({ id: z.string(), accelerator: z.string().nullable() }))
		.mutation(({ ctx, input }) => provider(ctx, "shortcut").setBind(input.id, input.accelerator)),
	reset: publicProcedure
		.input(z.object({ id: z.string().optional() }).optional())
		.mutation(({ ctx, input }) => provider(ctx, "shortcut").reset(input?.id)),
	capture: publicProcedure
		.input(z.object({ active: z.boolean() }))
		.mutation(({ ctx, input }) => provider(ctx, "shortcut").setCapturing(input.active)),
});
