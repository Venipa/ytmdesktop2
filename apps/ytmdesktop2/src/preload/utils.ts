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
	createPluginContext: (name: string, settings: any, playerApi: any, playerUiService: any, api: any, domUtils: any, log: any) => PluginContext;
}

// Constants
export const YOUTUBE_HOST_PREFIX = "music.youtube";
export const YTMD_READY_MESSAGE = "ytmd-ready";
export const YOUTUBE_MUSIC_HOST = "music.youtube.com";
export const DEFAULT_PLAYER_TIMEOUT = 30 * 1000;

type YtPlayerLike = {
	isReady?: (() => boolean) | boolean;
	addEventListener?: (event: string, handler: (...args: any[]) => void, ...rest: any[]) => void;
	removeEventListener?: (event: string, handler: (...args: any[]) => void, ...rest: any[]) => void;
	getPlayerStateObject?: () => unknown;
	getPlayerState?: () => unknown;
};

function readPlayerApi(): YtPlayerLike | null {
	return (window.domUtils?.playerApi?.() as YtPlayerLike | null | undefined) ?? null;
}

/** True when YTM playerApi is safe for afterInit hooks. */
export function isYoutubePlayerReady(player: YtPlayerLike | null | undefined): boolean {
	if (!player) return false;
	try {
		const readyFlag = typeof player.isReady === "function" ? player.isReady() : player.isReady;
		if (readyFlag) return true;
	} catch {
		/* ignore */
	}
	return false;
}

/**
 * Wait until ytmusic-app.playerApi exists and isReady().
 * Uses MutationObserver for API attach + event/rAF for ready — faster than fixed-interval poll only.
 */
export function waitForYoutubePlayerReady(timeoutMs: number = DEFAULT_PLAYER_TIMEOUT): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		let settled = false;
		let mo: MutationObserver | null = null;
		let rafId = 0;
		let pollId: ReturnType<typeof setTimeout> | undefined;
		let timeoutId: ReturnType<typeof setTimeout> | undefined;
		const readyHandlers: Array<{ event: string; fn: (...args: any[]) => void }> = [];

		const cleanup = () => {
			if (timeoutId) clearTimeout(timeoutId);
			if (pollId) clearTimeout(pollId);
			if (rafId) cancelAnimationFrame(rafId);
			mo?.disconnect();
			mo = null;
			const player = readPlayerApi();
			for (const { event, fn } of readyHandlers) {
				try {
					player?.removeEventListener?.(event, fn);
				} catch {
					/* ignore */
				}
			}
			readyHandlers.length = 0;
		};

		const finish = (err?: Error) => {
			if (settled) return;
			settled = true;
			cleanup();
			if (err) reject(err);
			else resolve();
		};

		timeoutId = setTimeout(() => finish(new Error("Unable to hook yt player")), timeoutMs);

		const tryReady = () => {
			const player = readPlayerApi();
			if (!isYoutubePlayerReady(player)) return false;
			finish();
			return true;
		};

		const bindReadySignals = (player: YtPlayerLike) => {
			if (!player.addEventListener || readyHandlers.length > 0) return;
			// Any of these means player internals are live; still gate on isReady() in tick
			const onSignal = () => {
				tryReady();
			};
			for (const event of ["onReady", "onStateChange", "onVideoDataChange", "onApiChange"]) {
				try {
					player.addEventListener(event, onSignal);
					readyHandlers.push({ event, fn: onSignal });
				} catch {
					/* ignore */
				}
			}
		};

		const tick = () => {
			if (settled) return;
			const player = readPlayerApi();
			if (player) {
				bindReadySignals(player);
				if (tryReady()) return;
			}
			rafId = requestAnimationFrame(tick);
		};

		// Catch late DOM upgrades (ytmusic-app / playerApi assignment)
		mo = new MutationObserver(() => {
			if (settled) return;
			const player = readPlayerApi();
			if (player) {
				bindReadySignals(player);
				tryReady();
			}
		});
		mo.observe(document.documentElement, { childList: true, subtree: true });

		// Kick immediately + rAF loop (isReady often flips between frames)
		if (!tryReady()) {
			const player = readPlayerApi();
			if (player) bindReadySignals(player);
			rafId = requestAnimationFrame(tick);
			// Low-frequency fallback if rAF throttled (background / minimized)
			const slowPoll = () => {
				if (settled) return;
				tryReady();
				pollId = setTimeout(slowPoll, 100);
			};
			pollId = setTimeout(slowPoll, 100);
		}
	});
}

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

	createPlayerReadyWaiter: (timeoutMs: number = DEFAULT_PLAYER_TIMEOUT) => waitForYoutubePlayerReady(timeoutMs),

	createPluginContext: (name: string, settings: any, playerApi: any, playerUiService: any, api: any, domUtils: any, log: any) => {
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
			playerUiService,
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
