import { basename } from "path";
import { ClientPlugin, initializePluginCommandsWithIPC } from "@plugins/utils";
import { Logger, createLogger } from "@shared/utils/console";
import { debounce, get, merge, set } from "lodash-es";
import type { PlayerApi } from "ytm-client-api";
import pkg from "../../package.json";
import { createPluginUtils, isYoutubeMusicHost } from "./utils";

export type PluginSettings = Record<string, any>;
export interface PluginContext {
	name: string;
	settings: PluginSettings;
	pluginSettings: PluginSettings;
	log: Logger;
	playerApi: PlayerApi;
	api: Window["api"];
	domUtils: Window["domUtils"];
	onSettingsChange: (fn: (key: string, value: any) => void) => () => void;
}

export interface PluginInfo {
	file: string;
	exec: (context: PluginContext) => void | (() => void);
	meta: any;
	cmds?: Record<string, (context: PluginContext, ...args: any[]) => void>;
	afterInit?: (context: PluginContext) => void;
	log: any;
	name: string;
	displayName: string;
}

export class PluginManager {
	private log = createLogger("YTMD");
	private plugins: PluginInfo[] = [];
	private settingsPromise: Promise<any>;
	private destroyFns: (() => void)[] = [];
	private isLoaded = false;
	private pluginUtils = createPluginUtils();

	constructor() {
		this.settingsPromise = window.api.settingsProvider.getAll({}).then((x) => (window.__ytd_settings = merge({}, x)));
		this.loadPlugins();
	}

	private loadPlugins(): void {
		const pluginModules = import.meta.glob("@plugins/youtube/*.plugin.ts", {
			eager: true,
		});

		this.plugins = Object.entries(pluginModules)
			.map(([filename, p]: [string, any]) => {
				const m = basename(filename);
				let { meta, exec, afterInit, cmds } = p.default as ClientPlugin;
				const pluginName = meta?.name;
				const pluginLog = this.pluginUtils.createPluginLogger(this.log, pluginName);

				if (meta) pluginLog.debug("enabled:", meta.enabled !== false);
				else return undefined;

				if (meta && meta.enabled === false) return undefined;

				return {
					file: m,
					exec,
					meta,
					cmds,
					afterInit,
					log: pluginLog,
					name: this.pluginUtils.createPluginName(m),
					displayName: meta.displayName,
				} as PluginInfo;
			})
			.filter((p): p is NonNullable<typeof p> => p !== undefined && p.meta && p.meta.enabled !== false);

		// Expose plugins globally
		window.__ytd_plugins = Object.freeze(this.plugins);
	}

	private getPlayerApi() {
		return window.domUtils.playerApi();
	}

	private createPluginContext(name: string): PluginContext {
		return this.pluginUtils.createPluginContext(name, window.__ytd_settings, this.getPlayerApi(), window.api, window.domUtils, this.log);
	}

	private async waitForPlayerReady(): Promise<void> {
		return this.pluginUtils.createPlayerReadyWaiter();
	}
	onSettingsChange(fn: (key: string, value: any) => void): () => void {
		const handler = debounce((ev: unknown, { key, value }: { key: string; value: any }) => {
			fn(key, value);
		}, 100);
		window.ipcRenderer.on("settingsProvider.change", handler);
		return () => window.ipcRenderer.off("settingsProvider.change", handler);
	}
	private setupSettingsListener(): void {
		try {
			window.ipcRenderer.on("settingsProvider.change", (ev, key, value) => {
				this.log.debug("settings.change", key, value);
				const prevValue = get(window.__ytd_settings, key);
				window.__ytd_settings = set(window.__ytd_settings, key, value);
				if (key.startsWith("plugins.")) {
					const [pluginName, settingKey] = key.split(".").slice(1);
					const plugin = this.plugins.find((p) => p.name === pluginName);
					if (plugin) {
						plugin.log.debug("settings.change", settingKey, value);
						if (plugin.meta.restartNeeded && settingKey === "enabled" && !!prevValue !== !!value) {
							window.api.action("app.restartNeeded");
						}
					}
				}
			});
		} catch (ex) {
			this.log.error("settings listener setup failed", ex);
		}
	}

	private async initializePlugins(): Promise<void> {
		// Execute plugins and collect destroy functions
		const results = await Promise.all(
			this.plugins.map(async (plugin) => {
				const pluginContext = this.createPluginContext(plugin.name);
				plugin.log.debug(plugin.name, plugin.meta);
				const result = await Promise.resolve(plugin.exec({ ...pluginContext, log: plugin.log, playerApi: this.getPlayerApi() }));
				return result;
			}),
		);

		// Filter out non-function results
		this.destroyFns = results.filter((fn): fn is () => void => typeof fn === "function");

		// Setup cleanup on beforeunload
		window.addEventListener("beforeunload", async () => {
			const currentUrl = new URL(location.href);
			if (this.destroyFns && currentUrl.hostname !== location.hostname && this.destroyFns.length > 0) {
				await Promise.all(this.destroyFns.map((fn) => Promise.resolve(fn())));
			}
		});
	}

	private async runAfterInitHooks(): Promise<void> {
		await Promise.all(
			this.plugins.map(async (plugin) => {
				if (!plugin.afterInit) return;
				const pluginContext = this.createPluginContext(plugin.name);
				await Promise.resolve(plugin.afterInit({ ...pluginContext, log: plugin.log, playerApi: this.getPlayerApi() }));
				this.log.child(`Client Plugin, ${plugin.name}`).debug(`afterInit execute`);
			}),
		);
	}

	private async initializePluginCommands(): Promise<void> {
		await Promise.all(
			this.plugins.map((plugin) => {
				const pluginContext = this.createPluginContext(plugin.name);
				// Convert PluginInfo to ClientPlugin for the initializePluginCommandsWithIPC function
				const clientPlugin: ClientPlugin = {
					name: plugin.name,
					displayName: plugin.displayName,
					exec: plugin.exec,
					afterInit: plugin.afterInit,
					cmds: plugin.cmds,
					meta: plugin.meta,
				};
				return Promise.resolve(initializePluginCommandsWithIPC(clientPlugin, { ...pluginContext, log: plugin.log, playerApi: this.getPlayerApi() }));
			}),
		);
	}
	private async removeChromecastIcon() {
		const style = await window.domUtils.createStyle(`
      ytmusic-cast-button.cast-button {
        display: none !important;
      }
    `);
		return () => style();
	}
	public async initialize(force?: boolean): Promise<void> {
		await this.settingsPromise;

		if (window.isYTMLoaded?.() && !force) {
			throw new Error("YTMD is already loaded, " + pkg.version);
		}
		this.log.debug("initializing...");
		this.isLoaded = false;
		window.isYTMLoaded = () => this.isLoaded;

		this.setupSettingsListener();
		this.log.debug("dom init...");

		await this.removeChromecastIcon().catch((ex) => this.log.error("removeChromecastIcon failed", ex));
		await new Promise<void>((resolve) =>
			window.domUtils.ensureDomLoaded(async () => {
				if (isYoutubeMusicHost()) {
					await this.initializePlugins();
					await this.waitForPlayerReady();
					this.log.debug("ytplayer loaded");

					await this.runAfterInitHooks();
					await this.initializePluginCommands();
				}

				window.api.emit("app.loadEnd");
				this.isLoaded = true;
				window.postMessage("ytmd-ready", "*");
				resolve();
			}),
		);
	}

	public getPlugins(): PluginInfo[] {
		return this.plugins;
	}

	public isInitialized(): boolean {
		return this.isLoaded;
	}
}
