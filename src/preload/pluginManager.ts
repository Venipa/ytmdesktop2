import { basename } from "path";
import { ClientPlugin, initializePluginCommandsWithIPC } from "@plugins/utils";
import { Logger, createLogger } from "@shared/utils/console";
import { merge, set } from "lodash-es";
import type { PlayerApi } from "ytm-client-api";
import pkg from "../../package.json";

export type PluginSettings = Record<string, any>;
export interface PluginContext {
	name: string;
	settings: PluginSettings;
	log: Logger;
	playerApi: PlayerApi;
	api: Window["api"];
	domUtils: Window["domUtils"];
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
				const pluginLog = this.log.child(`Client Plugin, ${meta.name}`);

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
					name: m
						.split(".")
						.slice(0, -1)
						.join(".")
						.replace(/.plugin$/, ""),
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

	private createPluginContext(): PluginContext {
		return {
			settings: new Proxy(window.__ytd_settings, {}),
			playerApi: this.getPlayerApi(),
			api: window.api,
			domUtils: window.domUtils,
			log: this.log,
			name: null,
		};
	}

	private async waitForPlayerReady(): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			let timeoutHandle: any;
			let checkHandle: any;

			const checkYTRoot = () => {
				if (!timeoutHandle) {
					timeoutHandle = setTimeout(() => {
						clearTimeout(checkHandle);
						reject(new Error("Unable to hook yt player"));
					}, 30 * 1000);
				}

				const ready = !!window.domUtils.playerApi()?.isReady();
				if (!ready) {
					checkHandle = setTimeout(checkYTRoot, 100);
				} else {
					clearTimeout(checkHandle);
					clearTimeout(timeoutHandle);
					return resolve();
				}
			};

			checkYTRoot();
		});
	}

	private setupSettingsListener(): void {
		window.ipcRenderer.on("settingsProvider.change", (ev, key, value) => {
			this.log.debug("settings.change", key, value);
			window.__ytd_settings = set(window.__ytd_settings, key, value);
		});
	}

	private async initializePlugins(): Promise<void> {
		const pluginContext = this.createPluginContext();

		// Execute plugins and collect destroy functions
		const results = await Promise.all(
			this.plugins.map(async (plugin) => {
				plugin.log.debug(plugin.name, plugin.meta);
				const result = plugin.exec({ ...pluginContext, log: plugin.log, playerApi: this.getPlayerApi(), name: plugin.name });
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
		const pluginContext = this.createPluginContext();

		await Promise.all(
			this.plugins.map(async (plugin) => {
				if (!plugin.afterInit) return;
				await Promise.resolve(plugin.afterInit({ ...pluginContext, log: plugin.log, playerApi: this.getPlayerApi() }));
				this.log.child(`Client Plugin, ${plugin.name}`).debug(`afterInit execute`);
			}),
		);
	}

	private async initializePluginCommands(): Promise<void> {
		const pluginContext = this.createPluginContext();

		await Promise.all(
			this.plugins.map((plugin) => {
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

	public async initialize(force?: boolean): Promise<void> {
		await this.settingsPromise;

		if (window.isYTMLoaded?.() && !force) {
			throw new Error("YTMD is already loaded, " + pkg.version);
		}

		this.isLoaded = false;
		window.isYTMLoaded = () => this.isLoaded;

		this.setupSettingsListener();

		await new Promise<void>((resolve) =>
			window.domUtils.ensureDomLoaded(async () => {
				const currentUrl = new URL(location.href);

				if (currentUrl.host === "music.youtube.com") {
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
