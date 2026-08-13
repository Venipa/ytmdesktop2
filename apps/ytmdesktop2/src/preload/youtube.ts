import { logger } from "@shared/utils/console";
import { contextBridge, webFrame } from "electron";
import pkg from "../../package.json";
import exposeData, { assignPreload, exposeToPage, settingsProvider } from "./base";
import { preloadLocal } from "./preload-local";
import { createContextExposer, createDomUtils, createInitializationUtils, createPreloadLogger } from "./utils";
import { YTMD_AGENT_SOURCE } from "./ytmd-agent";
import { createYtmdBridge } from "./ytmd-bridge";

const appVersion = pkg.version;

const log = createPreloadLogger("YTMD");
const contextExposer = createContextExposer();
const domUtils = createDomUtils();
const initUtils = createInitializationUtils();

const ytmd = createYtmdBridge(settingsProvider);
preloadLocal.ytmd = ytmd;
preloadLocal.api = exposeData.api;
preloadLocal.domUtils = exposeData.domUtils;
preloadLocal.ipcRenderer = exposeData.ipcRenderer;

// Preload-local globals for plugin host (never bridged when isolated).
assignPreload("appVersion", appVersion);
assignPreload("api", exposeData.api);
assignPreload("domUtils", exposeData.domUtils);
assignPreload("ipcRenderer", exposeData.ipcRenderer);
assignPreload("app", exposeData.app);
assignPreload("translations", exposeData.translations);
assignPreload("ytmd", ytmd);

// Page-visible surface: ytmd only under isolation.
const pageYtmd = {
	emit: ytmd.emit.bind(ytmd),
	on: ytmd.on.bind(ytmd),
	settings: ytmd.settings,
};
if (process.contextIsolated) {
	contextBridge.exposeInMainWorld("ytmd", pageYtmd);
} else {
	// Dual-mode shim period: keep fat page APIs until isolation flip.
	contextExposer.exposeAll(exposeData);
	exposeToPage("ytmd", pageYtmd);
}

domUtils.setupTrustedTypes();

async function injectYtmdAgent(): Promise<void> {
	const frame = webFrame as typeof webFrame & {
		executeJavaScriptInIsolatedWorld?: (worldId: number, scripts: { code: string }[]) => Promise<unknown>;
	};
	log.info("inject ytmd-agent", { isolated: process.contextIsolated, readyState: document.readyState });
	console.info("[YTMD][preload] inject agent", { isolated: process.contextIsolated, readyState: document.readyState });
	try {
		if (typeof frame.executeJavaScriptInIsolatedWorld === "function") {
			await frame.executeJavaScriptInIsolatedWorld(0, [{ code: YTMD_AGENT_SOURCE }]);
		} else {
			await webFrame.executeJavaScript(YTMD_AGENT_SOURCE);
		}
		log.info("ytmd-agent inject ok");
	} catch (err) {
		log.warn("ytmd-agent inject failed", err);
	}
}

const pluginManager = initUtils.createPluginManager();
const initFn = initUtils.createInitFunction(pluginManager);

window.__ytmd_loadingPromise = domUtils.createLoadingPromise();
assignPreload("__initYTMD", initFn);

let bootStarted = false;
async function bootYtmd(): Promise<void> {
	// Agent must listen before plugins post ytmd-ready, else page isYTMLoaded stays false.
	await injectYtmdAgent();
	await initFn();
}
function scheduleBoot(from: string): void {
	if (bootStarted) {
		log.info("boot already started, skip", { from });
		return;
	}
	bootStarted = true;
	log.info("boot start", { from, readyState: document.readyState });
	console.info("[YTMD][preload] boot start", { from, readyState: document.readyState });
	void bootYtmd().catch((err) => {
		logger.error("Failed to initialize YTMD", err);
	});
}
process.once("loaded", () => scheduleBoot("process.loaded"));
exposeData.domUtils.ensureDomLoaded(() => scheduleBoot("dom"));
