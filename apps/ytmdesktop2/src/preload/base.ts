import { contextBridge, ipcRenderer, webFrame } from "electron";
import { webUtils } from "electron/renderer";
import { ELECTRON_TRPC_CHANNEL } from "electron-trpc/main";
import pkg from "../../package.json";
import translations from "../translations";

/** electron-trpc requires contextIsolation; youtube view keeps it off for player hooks. */
type RendererGlobalElectronTRPC = {
  sendMessage: (operation: any) => void;
  onMessage: (callback: (args: any) => void) => void;
};
const exposeElectronTRPC = (): void => {
  const electronTRPC: RendererGlobalElectronTRPC = {
    sendMessage: (operation) => ipcRenderer.send(ELECTRON_TRPC_CHANNEL, operation),
    onMessage: (callback) =>
      ipcRenderer.on(ELECTRON_TRPC_CHANNEL, (_event, args) => callback(args)),
  } as unknown as RendererGlobalElectronTRPC;
  if (process.contextIsolated)
    contextBridge.exposeInMainWorld('electronTRPC', electronTRPC);
  else (window as any).electronTRPC = electronTRPC;
};
exposeElectronTRPC();
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
export const setContext = (key: string, value: any) => {
  if (process.contextIsolated) {
    contextBridge.exposeInMainWorld(key, value);
    return;
  }
  // Never clobber Node/Vite `process` — it must stay extensible for `process.env`
  if (key === "process") return;
  (window as any)[key] = value;
};

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
  quit: createIpcSender("app.quit") as (force?: boolean) => void,
};

// Player API cache — refresh from DOM until ready so we don't stick on a cold stub
const createPlayerApi = () => {
	let playerApiCache: any;
	const selectors = ["body>ytmusic-app", "ytmusic-app-layout>ytmusic-player-bar"] as const;
	return () => {
		for (const selector of selectors) {
			const fresh = (document.querySelector(selector) as any)?.playerApi;
			if (fresh) {
				playerApiCache = fresh;
				return fresh;
			}
		}
		return playerApiCache ?? null;
	};
};

const createPlayerUiService = () => {
  let playerUiServiceCache: any;
  return () => {
    const fresh = (document.querySelector("body>ytmusic-app") as any)?.playerUiService;
    if (fresh) playerUiServiceCache = fresh;
    return playerUiServiceCache ?? fresh ?? null;
  };
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
  app: {
    version: appVersion,
    environment: import.meta.env.MODE,
    platform: process.platform,
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
    getPathFromFile: (file: File) => webUtils.getPathForFile(file),
  },
  translations,
  domUtils: {
    async createAndRunScript(script: string, _key?: string) {
      return await webFrame.executeJavaScript(script);
    },
    async createStyle(css: string) {
      const key = webFrame.insertCSS(css);
      return () => webFrame.removeInsertedCSS(key);
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
    awaitElement: <T extends HTMLElement>(selector: string, options: MutationObserverInit = { childList: true, subtree: true }) =>
      new Promise<T>((resolve) => {
        const element = document.querySelector(selector) as T;
        if (element) {
          resolve(element as T);
        } else {
          const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
              mutation.addedNodes.forEach((node) => {
                if (node instanceof HTMLElement && (node.matches(selector) || node.querySelector(selector))) {
                  resolve(node as T);
                  observer.disconnect();
                }
              });
            });
          });
          ensureDomLoaded(() => {
            observer.observe(document.body, options);
          });
        }
      }),
    playerApi: createPlayerApi(),
    playerUiService: createPlayerUiService(),
    setInteractiveElements: createInteractiveElementsManager(),
  },
};
