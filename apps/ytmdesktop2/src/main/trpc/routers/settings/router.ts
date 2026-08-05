import { provider } from "@main/trpc/provider";
import { publicProcedure, router } from "@shared/trpc/trpc";
import { observable } from "@trpc/server/observable";
import { z } from "zod";

export const settingsRouter = router({
	get: publicProcedure.input(z.object({ key: z.string(), defaultValue: z.unknown().optional() })).query(({ ctx, input }): unknown => {
		const value = provider(ctx, "settings").get(input.key);
		return value === undefined || value === null ? input.defaultValue : value;
	}),
	getAll: publicProcedure.input(z.unknown().optional()).query(({ ctx, input }): unknown => {
		const value = provider(ctx, "settings").instance;
		return value === undefined || value === null ? input : value;
	}),
	update: publicProcedure.input(z.object({ key: z.string(), value: z.unknown() })).mutation(({ ctx, input }): unknown => {
		const settings = provider(ctx, "settings");
		settings.set(input.key, input.value);
		settings.saveToDrive();
		return input.value;
	}),
	set: publicProcedure.input(z.object({ key: z.string(), value: z.unknown() })).mutation(({ ctx, input }): void => {
		const settings = provider(ctx, "settings");
		settings.set(input.key, input.value);
		settings.saveToDrive();
	}),
	onChange: publicProcedure.subscription(({ ctx }) =>
		observable<{ key: string; value: unknown; prevValue: unknown }>((emit) => {
			const sub = provider(ctx, "settings").settingChanged.subscribe((ev) => emit.next(ev));
			return () => sub.unsubscribe();
		}),
	),
});
