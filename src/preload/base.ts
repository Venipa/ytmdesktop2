import { contextBridge, ipcRenderer, webFrame } from "electron";
import { webUtils } from "electron/renderer";
import pkg from "../../package.json";
import translations from "../translations";

const appVersion = import.meta.env.APP_VERSION || pkg.version;

// Helper functions to reduce repetition
const createIpcSender =
	(channel: string) =>
	(...data: any[]) =>
		ipcRenderer.send(channel, ...data);
const createIpcInvoker =
	(channel: string) =>
	(...data: any[]) =>
		ipcRenderer.invoke(channel, ...data);

// DOM utility functions
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

// Utility functions
export const basename = (path: string) => path.split(/[\\/]/).pop();
export const setContext = (key: string, value: any) => (process.contextIsolated ? contextBridge.exposeInMainWorld(key, value) : (window[key] = Object.freeze(value)));

// Configure IPC
ipcRenderer.setMaxListeners(100);

// Platform detection
const platform = {
	isMacOS: process.platform === "darwin",
	isWindows: process.platform === "win32",
	isLinux: process.platform === "linux",
};

// Settings provider methods
const settingsProvider = {
	getAll: createIpcInvoker("settingsProvider.getAll"),
	get: createIpcInvoker("settingsProvider.get"),
	set: (key: string, value: any) => ipcRenderer.send("settingsProvider.set", key, value),
	update: createIpcInvoker("settingsProvider.update"),
	save: createIpcSender("settingsProvider.save"),
};

// Window management methods
const windowMethods = {
	open: createIpcSender("subwindow.show"),
	close: createIpcSender("subwindow.close"),
};

// App control methods
const appMethods = {
	minimize: createIpcSender("app.minimize"),
	maximize: createIpcSender("app.maximize"),
	goback: createIpcSender("app.goback"),
	quit: (force?: boolean) => ipcRenderer.send("app.quit", !!force),
	installUpdate: createIpcSender("app.installUpdate"),
	checkUpdate: createIpcInvoker("app.checkUpdate"),
	isWin11: () => ipcRenderer.invoke("app.isWin11").catch(() => false),
};

// Player API cache
const createPlayerApi = () => {
	let playerApiCache: any;
	return () => playerApiCache || (playerApiCache = (document.querySelector("ytmusic-app-layout>ytmusic-player-bar") as any)?.playerApi);
};

// Interactive elements management
const createInteractiveElementsManager = () => {
	return <T extends HTMLElement>(interactiveElements: T[]) => {
		ipcRenderer.send("set-ignore-mouse-events", true, { forward: true });

		interactiveElements.forEach((element) => {
			element.addEventListener("mouseenter", () => {
				ipcRenderer.send("set-ignore-mouse-events", false);
			});

			element.addEventListener("mouseleave", () => {
				ipcRenderer.send("set-ignore-mouse-events", true, { forward: true });
			});
		});
	};
};
const ipc = {
	emit: ipcRenderer.send.bind(ipcRenderer) as typeof ipcRenderer.send,
	send: ipcRenderer.send.bind(ipcRenderer) as typeof ipcRenderer.send,
	on: ipcRenderer.on.bind(ipcRenderer) as typeof ipcRenderer.on,
	off: ipcRenderer.off.bind(ipcRenderer) as typeof ipcRenderer.off,
	invoke: ipcRenderer.invoke.bind(ipcRenderer) as typeof ipcRenderer.invoke,
	action: (event: string, ...data: any[]) => ipcRenderer.invoke(`action:${event}`, ...data),
	frame: ipcRenderer.sendToHost.bind(ipcRenderer) as typeof ipcRenderer.sendToHost,
};
export default {
	ipcRenderer: {
		...ipc,
		appVersion,
	},
	process: {
		version: appVersion,
		environment: import.meta.env.MODE,
		platform: process.platform,
		isWin11: appMethods.isWin11,
	},
	api: {
		version: appVersion,
		platform,
		plugins: [],
		settings: windowMethods,
		openWindow: windowMethods.open,
		closeWindow: windowMethods.close,
		...appMethods,
		settingsProvider,
		...ipc,
		reloadCustomCss: () => ipcRenderer.send("settings.customCssUpdate"),
		mainWindowState: createIpcInvoker("mainWindowState"),
		windowState: createIpcInvoker("windowState"),
		getPathFromFile: (file: File) => webUtils.getPathForFile(file),
	},
	translations,
	domUtils: {
		async createAndRunScript(script: string, key?: string) {
			return await webFrame.executeJavaScript(script);
		},
		ensureDomLoaded,
		ensureWindowLoaded(f: () => void) {
			return ensureDomLoaded(() => {
				if (document.readyState === "complete") return f();
				window.addEventListener("load", f, { once: true });
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
		playerApi: createPlayerApi(),
		setInteractiveElements: createInteractiveElementsManager(),
	},
};
