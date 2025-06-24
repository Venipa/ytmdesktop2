import { createLogger } from "@shared/utils/console";
import DOMPurify from "dompurify";
import { ipcRenderer } from "electron";
import { debounce, get, merge, set } from "lodash-es";
import { setContext } from "./base";
import { PluginContext, PluginManager, PluginSettings } from "./pluginManager";

// Types
export interface SettingsManager {
	get: (key: string) => any;
	update: (key: string, value: any) => void;
}

export interface ContextExposer {
	exposeAll: (data: Record<string, any>) => void;
	expose: (key: string, value: any) => void;
}

export interface DomUtils {
	isYoutubeWindow: () => boolean;
	setupTrustedTypes: () => void;
	createLoadingPromise: () => Promise<void>;
}

export interface InitializationUtils {
	createPluginManager: () => PluginManager;
	createInitFunction: (pluginManager: PluginManager) => (force?: boolean) => Promise<void>;
}

export interface PluginUtils {
	createPluginName: (filename: string) => string;
	createPluginLogger: (baseLogger: any, pluginName: string) => any;
	createPlayerReadyWaiter: (timeoutMs?: number) => Promise<void>;
	createPluginContext: (name: string, settings: any, playerApi: any, api: any, domUtils: any, log: any) => PluginContext;
}

// Constants
export const YOUTUBE_HOST_PREFIX = "music.youtube";
export const YTMD_READY_MESSAGE = "ytmd-ready";
export const YOUTUBE_MUSIC_HOST = "music.youtube.com";
export const DEFAULT_PLAYER_TIMEOUT = 30 * 1000;

// Logger
export const createPreloadLogger = (name: string) => createLogger(name);

// Context exposure utilities
export const createContextExposer = (): ContextExposer => ({
	exposeAll: (data: Record<string, any>) => {
		Object.entries(data).forEach(([key, endpoints]) => {
			setContext(key, endpoints);
		});
	},

	expose: (key: string, value: any) => {
		setContext(key, value);
	},
});

// Settings management utilities
export const createSettingsManager = async (preloadRoot: any): Promise<SettingsManager> => {
	let settings = {};

	await preloadRoot.api.settingsProvider.getAll({}).then((x: any) => {
		settings = merge(settings, x);
	});

	// Setup settings change listener
	document.addEventListener("DOMContentLoaded", () => {
		preloadRoot.ipcRenderer.on("settingsProvider.change", (ev: any, key: string, value: any) => {
			if (settings) set(settings, key, value);
			console.log("api:update-setting", key, value);
		});
	});

	return {
		get: (key: string) => get(settings, key),
		update: (key: string, value: any) => set(settings, key, value),
	};
};

// DOM utilities
export const createDomUtils = (): DomUtils => ({
	isYoutubeWindow: () => window && document.location.host.indexOf(YOUTUBE_HOST_PREFIX) === 0,

	setupTrustedTypes: () => {
		try {
			if (window.trustedTypes?.defaultPolicy?.name === "default") {
				window.trustedTypes.createPolicy("default", {
					createHTML: (string: string) => DOMPurify.sanitize(string, { RETURN_TRUSTED_TYPE: true }) as any,
					createScriptURL: (string: string) => string, // warning: this is unsafe!
					createScript: (string: string) => string, // warning: this is unsafe!
				});
			}
		} catch {}
	},

	createLoadingPromise: () =>
		new Promise<void>((resolve) => {
			window.addEventListener("message", (ev) => {
				if (ev.data !== YTMD_READY_MESSAGE) return;
				resolve();
			});
		}),
});

// Initialization utilities
export const createInitializationUtils = (): InitializationUtils => ({
	createPluginManager: () => {
		return new PluginManager();
	},

	createInitFunction: (pluginManager: PluginManager) => async (force?: boolean) => {
		await pluginManager.initialize(force);
	},
});
export const parsePluginSettingKey = (name: string) => name.replace(/[-\ ]/g, "_");
// Plugin utilities
export const createPluginUtils = (): PluginUtils => ({
	createPluginName: (filename: string) =>
		filename
			.split(".")
			.slice(0, -1)
			.join(".")
			.replace(/.plugin$/, ""),

	createPluginLogger: (baseLogger: any, pluginName: string) => baseLogger.child(`Client Plugin, ${pluginName}`),

	createPlayerReadyWaiter: (timeoutMs: number = DEFAULT_PLAYER_TIMEOUT) =>
		new Promise<void>((resolve, reject) => {
			let timeoutHandle: any;
			let checkHandle: any;

			const checkYTRoot = () => {
				if (!timeoutHandle) {
					timeoutHandle = setTimeout(() => {
						clearTimeout(checkHandle);
						reject(new Error("Unable to hook yt player"));
					}, timeoutMs);
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
		}),
	createPluginContext: (name: string, settings: any, playerApi: any, api: any, domUtils: any, log: any) => {
		const pluginKey = parsePluginSettingKey(name);
		return {
			settings: new Proxy(settings, {
				get: (target, prop) => {
					return target[prop];
				},
			}) as PluginSettings,
			pluginSettings: new Proxy(settings, {
				get: (target, prop) => {
					return target.plugins?.[pluginKey]?.[prop];
				},
			}) as PluginSettings,
			playerApi,
			api,
			domUtils,
			log,
			name: null,
			onSettingsChange: (fn: (key: string, value: any) => void) => {
				const handler = debounce((ev: unknown, { key, value }: { key: string; value: any }) => {
					fn(key, value);
				}, 100);
				window.ipcRenderer.on("settingsProvider.change", handler);
				return () => window.ipcRenderer.off("settingsProvider.change", handler);
			},
		};
	},
});

// Common initialization patterns
export const initializeWithDomLoaded = (callback: () => void | Promise<void>, preloadRoot: any) => {
	preloadRoot.domUtils.ensureDomLoaded(async () => {
		await Promise.resolve(callback());
	});
};

// IPC utilities
export const createIpcReporter = (eventName: string) => () => {
	ipcRenderer.send(eventName);
};

// Host detection utilities
export const createHostDetector = (prefix: string) => () => window && document.location.host.indexOf(prefix) === 0;

// URL utilities
export const isYoutubeMusicHost = () => {
	const currentUrl = new URL(location.href);
	return currentUrl.host === YOUTUBE_MUSIC_HOST;
};
