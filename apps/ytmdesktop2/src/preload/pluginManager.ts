import type { PluginOptions } from "@plugins/utils";
import { ClientPlugin, initializePluginCommandsWithIPC } from "@plugins/utils";
import { createLogger, Logger } from "@shared/utils/console";
import type { YtmPageBridge } from "@shared/ytm";
import { debounce, get, merge, set } from "lodash-es";
import { basename } from "path";
import type { PlayerApi, PlayerUiService } from "ytm-client-api";
import pkg from "../../package.json";
import { getPreloadApi, getPreloadDomUtils, getYtmd } from "./preload-local";
import type { PreloadYtmdHost } from "./ytmd-bridge";
import { createPluginUtils, isYoutubeMusicHost } from "./utils";
import world0HostSource from "./generated/ytmd-world0-host.js?raw";
export type PluginSettings = Record<string, any>;
export interface PluginContext {
	name: string;
	settings: PluginSettings;
	pluginSettings: PluginSettings;
	log: Logger;
	playerApi: PlayerApi;
	playerUiService: PlayerUiService;
	api: Window["api"];
	domUtils: Window["domUtils"];
	ytmd: PreloadYtmdHost | YtmPageBridge | null;
	onSettingsChange: (fn: (key: string, value: any) => void) => () => void;
}

export interface PluginInfo {
	file: string;
	exec: (context: PluginContext) => void | (() => void);
	meta: PluginOptions;
	cmds?: Record<string, (context: PluginContext, ...args: any[]) => void>;
	afterInit?: (context: PluginContext) => void;
	onConfigChange?: (key: string, value: unknown, context: PluginContext) => void | Promise<void>;
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
		const api = getPreloadApi();
		this.settingsPromise = api.settingsProvider.getAll({}).then((x) => (window.__ytd_settings = merge({}, x)));
		this.loadPlugins();
	}

	private loadPlugins(): void {
		const pluginModules = import.meta.glob("@plugins/youtube/*.plugin.ts", {
			eager: true,
		});

		this.plugins = Object.entries(pluginModules)
			.map(([filename, p]: [string, any]) => {
				const m = basename(filename);
				let { meta, exec, afterInit, cmds, onConfigChange } = p.default as ClientPlugin;
				const pluginName = meta?.name;
				const pluginLog = this.pluginUtils.createPluginLogger(this.log, pluginName);

				if (meta) pluginLog.debug("load", { enabled: meta.enabled !== false });
				else return undefined;

				if (meta && meta.enabled === false) return undefined;
				if (import.meta.env.DEV) meta.throwOnError = true;
				return {
					file: m,
					exec,
					meta,
					cmds,
					afterInit,
					onConfigChange,
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
		return getPreloadDomUtils().playerApi();
	}
	private getPlayerUiService() {
		return getPreloadDomUtils().playerUiService();
	}

	private createPluginContext(name: string): PluginContext {
		return this.pluginUtils.createPluginContext(
			name,
			window.__ytd_settings,
			this.getPlayerApi(),
			this.getPlayerUiService(),
			getPreloadApi(),
			getPreloadDomUtils(),
			this.log,
			getYtmd(),
		);
	}

	private async waitForPlayerReady(): Promise<void> {
		return this.pluginUtils.createPlayerReadyWaiter();
	}
	onSettingsChange(fn: (key: string, value: any) => void): () => void {
		const handler = debounce(
			(key: string, value: any) => {
				fn(key, value);
			},
			100,
			{ leading: true, trailing: true },
		);
		return getYtmd().onInternal("settingsProvider.change", (key, value) => handler(String(key), value));
	}
	private setupSettingsListener(): void {
		try {
			getYtmd().onInternal("settingsProvider.change", (key, value) => {
				if (typeof key !== "string") return;
				this.log.debug("settings.change", key, value);
				const prevValue = get(window.__ytd_settings, key);
				window.__ytd_settings = set(window.__ytd_settings, key, value);
				if (key.startsWith("plugins.")) {
					const [pluginName, settingKey] = key.split(".").slice(1);
					const plugin = this.plugins.find((p) => p.name === pluginName);
					if (plugin) {
						plugin.log.debug("settings.change", settingKey, value);
						if (plugin.meta.restartNeeded && settingKey === "enabled" && !!prevValue !== !!value) {
							getPreloadApi().action("app.restartNeeded");
						}
					}
				}
				for (const plugin of this.plugins) {
					if (!plugin.onConfigChange) continue;
					const pluginContext = this.createPluginContext(plugin.name);
					void Promise.resolve(
						plugin.onConfigChange(key, value, { ...pluginContext, log: plugin.log, playerApi: this.getPlayerApi() }),
					).catch((err) => {
						plugin.log.error("onConfigChange failed", err);
					});
				}
			});
		} catch (ex) {
			this.log.error("settings listener setup failed", ex);
		}
	}

	/** Inject page-world host (onPlayerApiReady + DOM plugins). */
	private async injectWorld0Host(): Promise<void> {
		try {
			await getPreloadDomUtils().createAndRunScript(world0HostSource, "ytmd-world0-host");
			this.log.debug("world-0 host injected");
		} catch (err) {
			this.log.error("world-0 host inject failed", err);
		}
	}

	private async initializePlugins(): Promise<void> {
		await this.injectWorld0Host();

		// Execute preload plugins and collect destroy functions
		const results = await Promise.all(
			this.plugins.map(async (plugin) => {
				const pluginContext = this.createPluginContext(plugin.name);
				plugin.log.debug("exec", { displayName: plugin.meta.displayName });
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
				await Promise.resolve(plugin.afterInit({ ...pluginContext, log: plugin.log, playerApi: this.getPlayerApi() })).catch((err) => {
					this.log.error(`Error running afterInit hook for plugin ${plugin.name}`, err);
				});
				plugin.log.debug("afterInit");
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
		const style = await getPreloadDomUtils().createStyle(`
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
		const markReady = () => {
			getPreloadApi().emit("app.loadEnd");
			this.isLoaded = true;
			window.postMessage("ytmd-ready", "*");
		};
		await this.removeChromecastIcon().catch((ex) => this.log.error("removeChromecastIcon failed", ex));
		await new Promise<void>((resolve, reject) =>
			getPreloadDomUtils().ensureDomLoaded(async () => {
				try {
					if (isYoutubeMusicHost()) {
						await this.initializePlugins();
						// Signed-out shells often never flip isReady() — soft-fail so loadEnd still fires.
						await this.waitForPlayerReady().catch((err) => {
							this.log.warn("ytplayer not ready, continuing", err);
						});
						this.log.debug("ytplayer ready");

						await this.runAfterInitHooks();
						await this.initializePluginCommands();
					}

					markReady();
					resolve();
				} catch (ex) {
					this.log.error("Failed to initialize plugins", ex);
					if (!this.isLoaded) markReady();
					reject(ex);
				}
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
