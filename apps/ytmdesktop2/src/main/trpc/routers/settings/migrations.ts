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
	{
		hook(store) {
			const data = store.store as SettingsStore & { app?: { beta?: boolean; channel?: string } };
			if (data.app?.channel === "stable" || data.app?.channel === "beta" || data.app?.channel === "alpha") {
				if ("beta" in (data.app ?? {})) store.delete("app.beta" as keyof SettingsStore);
				return;
			}
			const legacyBeta = !!(data.app as { beta?: boolean } | undefined)?.beta;
			store.set("app.channel", legacyBeta ? "beta" : "stable");
			store.delete("app.beta" as keyof SettingsStore);
		},
	},
	{
		hook(store) {
			store.set("themes.blur", false);
		},
	},
	{
		hook(store) {
			const current = (store.store as SettingsStore)?.player?.deepLinkOpen;
			if (current === "ask" || current === "play") return;
			store.set("player.deepLinkOpen", "ask");
		},
	},
	{
		hook(store) {
			const current = store.store?.lyrics;
      if (current) return;
			store.set("lyrics", {
				enabled: false,
				showTimeCodes: false,
				showEvenIfInexact: true,
				showProgressBar: true,
				providers: [
					{ id: "better-lyrics", enabled: true },
					{ id: "unison", enabled: true },
					{ id: "lrclib", enabled: true },
				],
			});
		},
	},
	{
		hook(store) {
			const current = store.store?.lyrics;
			if (!current) return;

			if ("showWordSync" in current) store.delete("lyrics.showWordSync" as keyof SettingsStore);
			if ("estimateWordTiming" in current) store.delete("lyrics.estimateWordTiming" as keyof SettingsStore);

			const providers = current.providers;
			if (!Array.isArray(providers) || !providers.length) {
				store.set("lyrics.providers", [
					{ id: "better-lyrics", enabled: true },
					{ id: "unison", enabled: true },
					{ id: "lrclib", enabled: true },
				]);
				return;
			}

			if (providers.every((item) => item && typeof item === "object" && "id" in item)) return;

			const next = providers
				.map((item) => {
					if (typeof item === "string") return { id: item, enabled: true };
					return null;
				})
				.filter(Boolean);
			if (!next.length) return;
			store.set("lyrics.providers", next as SettingsStore["lyrics"]["providers"]);
		},
	},
	{
		hook(store) {
			const current = (store.store as SettingsStore)?.trayView?.pinned;
			if (typeof current === "boolean") return;
			let pinned = false;
			try {
				const legacyPath = path.resolve(app.getPath("userData"), "tray-view.yml");
				if (statSync(legacyPath, { throwIfNoEntry: false })) {
					const raw = readFileSync(legacyPath, "utf8");
					pinned = /^\s*pinned:\s*true\s*$/m.test(raw);
				}
			} catch {
				pinned = false;
			}
			store.set("trayView.pinned", pinned);
		},
	},
];

export default migrations;
