import { fromIpcEvent } from "@main/trpc/fromIpcEvent";
import IPC_EVENT_NAMES from "@shared/constants/eventNames";
import { provider } from "@shared/trpc/context";
import { publicProcedure, router } from "@shared/trpc/trpc";
import { z } from "zod";

export const settingsRouter = router({
	get: publicProcedure.input(z.object({ key: z.string(), defaultValue: z.unknown().optional() })).query(({ ctx, input }) => {
		const value = provider(ctx, "settings").get(input.key);
		return value === undefined || value === null ? input.defaultValue : value;
	}),
	getAll: publicProcedure.input(z.unknown().optional()).query(({ ctx, input }) => {
		const value = provider(ctx, "settings").instance;
		return value === undefined || value === null ? input : value;
	}),
	update: publicProcedure.input(z.object({ key: z.string(), value: z.unknown() })).mutation(({ ctx, input }) => {
		const settings = provider(ctx, "settings");
		settings.set(input.key, input.value);
		settings.saveToDrive();
		return input.value;
	}),
	set: publicProcedure.input(z.object({ key: z.string(), value: z.unknown() })).mutation(({ ctx, input }) => {
		const settings = provider(ctx, "settings");
		settings.set(input.key, input.value);
		settings.saveToDrive();
	}),
	onChange: publicProcedure.subscription(() =>
		fromIpcEvent<{ key: string; value: unknown; prevValue: unknown }>(IPC_EVENT_NAMES.SERVER_SETTINGS_CHANGE, (args) => {
			const [key, value, prevValue] = args as [string, unknown, unknown];
			return { key, value, prevValue };
		}),
	),
});
