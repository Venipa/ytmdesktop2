import { webFrame } from "electron";
import preloadRoot from "./base";
import { createContextExposer, createSettingsManager } from "./utils";

/** App chrome only — freeze page zoom at 1× (OS DPI still applies). */
try {
	webFrame.setZoomFactor(1);
	void webFrame.setVisualZoomLevelLimits(1, 1);
} catch {
	/* ignore */
}

// Initialize context exposure
const contextExposer = createContextExposer();
contextExposer.exposeAll(preloadRoot);

// Initialize settings management
(async function () {
	const settingsManager = await createSettingsManager(preloadRoot);
	contextExposer.expose("settings", {
		get: settingsManager.get,
	});
})();
