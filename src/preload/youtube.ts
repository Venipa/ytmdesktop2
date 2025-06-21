import { createLogger } from "@shared/utils/console";
import DOMPurify from "dompurify";
import pkg from "../../package.json";
import exposeData, { setContext } from "./base";
import { PluginManager } from "./pluginManager";

const appVersion = pkg.version;

const log = createLogger("YTMD");
setContext("appVersion", appVersion);
Object.entries(exposeData).forEach(([key, endpoints]) => {
	setContext(key, endpoints);
});

try {
	if (window.trustedTypes?.defaultPolicy?.name === "default")
		window.trustedTypes.createPolicy("default", {
			createHTML: (string) => DOMPurify.sanitize(string, { RETURN_TRUSTED_TYPE: true }) as any,
			createScriptURL: (string) => string, // warning: this is unsafe!
			createScript: (string) => string, // warning: this is unsafe!
		});
} catch {}

// Create plugin manager instance
const pluginManager = new PluginManager();

// Create loading promise
window.__ytmd_loadingPromise = new Promise<void>((resolve) => {
	window.addEventListener("message", (ev) => {
		if (ev.data !== "ytmd-ready") return;
		resolve();
	});
});

const initFn = async (force?: boolean) => {
	await pluginManager.initialize(force);
};

setContext("__initYTMD", initFn);

process.on("loaded", () => {
	initFn();
});
