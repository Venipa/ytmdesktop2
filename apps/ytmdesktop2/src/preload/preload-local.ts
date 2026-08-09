import type { PreloadYtmdHost } from "./ytmd-bridge";
import type exposeData from "./base";

type DomUtils = typeof exposeData.domUtils;
type Api = typeof exposeData.api;
type Ipc = typeof exposeData.ipcRenderer;

/**
 * Preload-only refs. Survive contextIsolation flip — plugins read these,
 * page world only sees `window.ytmd` via contextBridge.
 */
export const preloadLocal: {
	ytmd: PreloadYtmdHost | null;
	api: Api | null;
	domUtils: DomUtils | null;
	ipcRenderer: Ipc | null;
} = {
	ytmd: null,
	api: null,
	domUtils: null,
	ipcRenderer: null,
};

export function getYtmd(): PreloadYtmdHost {
	if (!preloadLocal.ytmd) throw new Error("ytmd bridge not ready");
	return preloadLocal.ytmd;
}

export function getPreloadApi(): Api {
	if (!preloadLocal.api) throw new Error("preload api not ready");
	return preloadLocal.api;
}

export function getPreloadDomUtils(): DomUtils {
	if (!preloadLocal.domUtils) throw new Error("preload domUtils not ready");
	return preloadLocal.domUtils;
}
