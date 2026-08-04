import { provider } from "@main/trpc/provider";
import SettingsProvider from "@main/trpc/routers/settings/service";
import { publicProcedure, router } from "@shared/trpc/trpc";
import { observable } from "@trpc/server/observable";
import { z } from "zod";

type SettingsSvc = {
	get(key: string, defaultValue?: unknown): unknown;
	readonly instance: unknown;
	set(key: string, value: unknown): unknown;
	saveToDrive(): void;
};

export const settingsRouter = router({
	get: publicProcedure.input(z.object({ key: z.string(), defaultValue: z.unknown().optional() })).query(({ ctx, input }): unknown => {
		const value = provider<SettingsSvc>(ctx, "settings").get(input.key);
		return value === undefined || value === null ? input.defaultValue : value;
	}),
	getAll: publicProcedure.input(z.unknown().optional()).query(({ ctx, input }): unknown => {
		const value = provider<SettingsSvc>(ctx, "settings").instance;
		return value === undefined || value === null ? input : value;
	}),
	update: publicProcedure.input(z.object({ key: z.string(), value: z.unknown() })).mutation(({ ctx, input }): unknown => {
		const settings = provider<SettingsSvc>(ctx, "settings");
		settings.set(input.key, input.value);
		settings.saveToDrive();
		return input.value;
	}),
	set: publicProcedure.input(z.object({ key: z.string(), value: z.unknown() })).mutation(({ ctx, input }): void => {
		const settings = provider<SettingsSvc>(ctx, "settings");
		settings.set(input.key, input.value);
		settings.saveToDrive();
	}),
	onChange: publicProcedure.subscription(({ ctx }) =>
		observable<{ key: string; value: unknown; prevValue: unknown }>((emit) => {
			const sub = provider<SettingsProvider>(ctx, "settings").settingChanged.subscribe((ev) => emit.next(ev));
			return () => sub.unsubscribe();
		}),
	),
});
