import preloadRoot from "./base";
import { createContextExposer, createSettingsManager } from "./utils";

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
