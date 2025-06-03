import { contextBridge } from "electron";
import { ipcRenderer, webUtils } from "electron/renderer";
import pkg from "../../package.json";
import type { ClientPluginSerialized } from "../main/utils/pluginManager";
import translations from "../translations";
const appVersion = import.meta.env.APP_VERSION || pkg.version;
function ensureDomLoaded(f: () => void) {
	if (["interactive", "complete"].indexOf(document.readyState) > -1) {
		f();
	} else {
		let triggered = false;
		document.addEventListener("DOMContentLoaded", () => {
			if (!triggered) {
				triggered = true;
				setTimeout(f, 1);
			}
		});
	}
}
export const basename = (path: string) => path.split(/[\\/]/).pop();
export const setContext = (key: string, value: any) => (process.contextIsolated ? contextBridge.exposeInMainWorld(key, value) : (window[key] = Object.freeze(value)));

export default {
	ipcRenderer: {
		emit: (event, ...data) => ipcRenderer.send(event, ...data),
		on: (channel, func) => ipcRenderer.on(channel, func),
		off: (channel, func) => ipcRenderer.off(channel, func),
		invoke: (channel, ...data) => ipcRenderer.invoke(channel, ...data),
		appVersion: appVersion,
	},
	pluginManager: {
		loadPlugins: () => ipcRenderer.invoke("pluginManager.loadPlugins") as Promise<void>,
		getPlugins: () => ipcRenderer.invoke("pluginManager.getPlugins") as Promise<ClientPluginSerialized[]>,
		getPlugin: (name: string) => ipcRenderer.invoke("pluginManager.getPlugin", name) as Promise<ClientPluginSerialized | undefined>,
		getEnabledPlugins: () => ipcRenderer.invoke("pluginManager.getEnabledPlugins") as Promise<ClientPluginSerialized[]>,
	},
	process: {
		version: appVersion,
		environment: import.meta.env.MODE,
		platform: process.platform,
		isWin11: () => ipcRenderer.invoke("app.isWin11").catch(() => false),
	},
	api: {
		ipcRenderer: {
			emit: (event, ...data) => ipcRenderer.send(event, ...data),
			on: (channel, func) => ipcRenderer.on(channel, func),
			off: (channel, func) => ipcRenderer.off(channel, func),
			invoke: (channel, ...data) => ipcRenderer.invoke(channel, ...data),
			appVersion: appVersion,
		},
		version: appVersion,
		plugins: [],
		settings: {
			open: (windowName: string) => ipcRenderer.send("subwindow.show", windowName),
			close: (windowName?: string) => ipcRenderer.send("subwindow.close", windowName),
		},
		openWindow: (windowName: string) => ipcRenderer.send("subwindow.show", windowName),
		closeWindow: (windowName?: string) => ipcRenderer.send("subwindow.close", windowName),
		installUpdate: () => ipcRenderer.send("app.installUpdate"),
		checkUpdate: () => ipcRenderer.invoke("app.checkUpdate"),
		settingsProvider: {
			getAll: (defaultValue: any) => ipcRenderer.invoke("settingsProvider.getAll", defaultValue),
			get: (key: string, defaultValue: any) => ipcRenderer.invoke("settingsProvider.get", key, defaultValue),
			set: (key: string, value: any) =>
				new Promise((resolve) => {
					return resolve(ipcRenderer.send("settingsProvider.set", key, value));
				}),
			update: (key, value) => ipcRenderer.invoke("settingsProvider.update", key, value),
			save: () => ipcRenderer.send("settingsProvider.save"),
		},
		minimize: () => ipcRenderer.send("app.minimize"),
		maximize: () => ipcRenderer.send("app.maximize"),
		goback: () => ipcRenderer.send("app.goback"),
		quit: (force?: boolean) => ipcRenderer.send("app.quit", !!force),
		action: (event: string, ...data: any[]) => ipcRenderer.invoke(`action:${event}`, ...data),
		invoke: (event: string, ...data: any[]) => ipcRenderer.invoke(event, ...data),
		emit: (event: string, ...data: any[]) => ipcRenderer.send(event, ...data),
		on: (channel: string, func) => ipcRenderer.on(channel, func),
		off: (channel: string, func) => ipcRenderer.off(channel, func),
		reloadCustomCss: () => ipcRenderer.send("settings.customCssUpdate"),
		mainWindowState: () => ipcRenderer.invoke("mainWindowState"),
		windowState: () => ipcRenderer.invoke("windowState"),
		getPathFromFile: (file: File) => webUtils.getPathForFile(file),
		customcss: {
			inject: () => ipcRenderer.invoke("action:customcss.inject"),
			clear: () => ipcRenderer.invoke("action:customcss.clear"),
		},
	},
	translations,
	domUtils: {
		ensureDomLoaded,
		ensureWindowLoaded(f: () => void) {
			return ensureDomLoaded(() => {
				window.addEventListener("load", f);
			});
		},
		ensureWindow() {
			return new Promise<Window>((resolve) =>
				window.addEventListener(
					"DOMContentLoaded",
					function () {
						resolve(this);
					},
					{ once: true },
				),
			);
		},
		playerApi: (() => {
			let playerApiCache: any;
			return () => playerApiCache || (playerApiCache = (document.querySelector("ytmusic-app-layout>ytmusic-player-bar") as any)?.playerApi);
		})(),
		setInteractiveElements: <T extends HTMLElement>(interactiveElements: T[]) => {
			let isMouseOverInteractiveElement = false;
			ipcRenderer.send("set-ignore-mouse-events", true, { forward: true });
			interactiveElements.forEach((element) => {
				element.addEventListener("mouseenter", () => {
					isMouseOverInteractiveElement = true;
					ipcRenderer.send("set-ignore-mouse-events", false);
				});

				element.addEventListener("mouseleave", () => {
					isMouseOverInteractiveElement = false;
					ipcRenderer.send("set-ignore-mouse-events", true, { forward: true });
				});
			});
		},
	},
};
