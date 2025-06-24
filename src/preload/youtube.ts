import pkg from "../../package.json";
import exposeData, { setContext } from "./base";
import { createContextExposer, createDomUtils, createInitializationUtils, createPreloadLogger } from "./utils";

const appVersion = pkg.version;

// Initialize utilities
const log = createPreloadLogger("YTMD");
const contextExposer = createContextExposer();
const domUtils = createDomUtils();
const initUtils = createInitializationUtils();

// Setup context and trusted types
setContext("appVersion", appVersion);
contextExposer.exposeAll(exposeData);
domUtils.setupTrustedTypes();

// Create plugin manager and initialization
const pluginManager = initUtils.createPluginManager();
const initFn = initUtils.createInitFunction(pluginManager);

// Create loading promise
window.__ytmd_loadingPromise = domUtils.createLoadingPromise();

// Expose initialization function
setContext("__initYTMD", initFn);

// Initialize on process load
process.on("loaded", () => {
	initFn();
});
