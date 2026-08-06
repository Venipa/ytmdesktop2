import { platform } from "@electron-toolkit/utils";
import type { LegacyCustomCssConfig } from "@main/trpc/routers/themes/types";
import { app } from "electron";
import { Migration } from "electron-conf";
import { readFileSync, rmSync, statSync } from "fs";
import path from "path";
import type { SettingsStore } from "./service";

const migrations: Omit<Migration<SettingsStore>, "version">[] = [
	{
		hook(store) {
			const { migratedFromJson } = store.store?.__meta ?? {};
			if (migratedFromJson) return;
			const oldConfigPath = path.resolve(app.getPath("userData"), "app-settings.json");
			if (!statSync(oldConfigPath, { throwIfNoEntry: false })) {
				store.set("__meta.migratedFromJson", true);
				return;
			}
			const oldConfigBody = readFileSync(oldConfigPath, "utf8");
			if (!oldConfigBody) return;
			rmSync(oldConfigPath);
			const oldConfig = JSON.parse(oldConfigBody);
			store.set(oldConfig);
			store.set("__meta.migratedFromJson", true);
		},
	},
	{
		hook(store) {
			store.set("volumeRatio", {
				enabled: true,
				volume: 0.1,
			});
		},
	},
	{
		hook(store) {
			store.set("plugins", {
				bypass_age_restrictions: {
					enabled: true,
				},
			});
		},
	},
	{
		hook(store) {
			store.set("app.enableTaskbarProgress", platform.isWindows);
		},
	},
	{
		hook(store) {
			store.set("customcss.thumbnailBackground", false);
		},
	},
	{
		hook(store) {
			const data = store.store as SettingsStore & { customcss?: LegacyCustomCssConfig };
			if (data.themes && !data.customcss) return;
			const old = data.customcss;
			if (!old) return;

			const defaultPath = path.resolve(app.getPath("documents"), "ytmdesktop", "custom.scss");
			const file = old.scssFile ?? null;
			const isCustom = !!file && path.normalize(file) !== path.normalize(defaultPath);

			store.set("themes", {
				enabled: old.enabled ?? true,
				selected: isCustom ? "custom" : "default",
				customFile: file,
				watching: old.watching ?? false,
				thumbnailBackground: old.thumbnailBackground ?? true,
			});
			store.delete("customcss" as keyof SettingsStore);
		},
	},
];

export default migrations;
