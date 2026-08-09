import disableScriptContent from "./resources/volume-ratio/disable-script.js?raw";
import enableScriptContent from "./resources/volume-ratio/enable-script.js?raw";
import { forceUpdateVolume, volumeRatioPage } from "./volume-ratio.page";
import type { RendererPluginRegistration } from "./world0/types";

const SETTING_KEY = "volumeRatio.enabled";

/**
 * Page-world half: playerApi.setVolume only.
 * Enable/disable scripts run from preload via createAndRunScript (Trusted Types safe).
 */
const volumeRatioRenderer: RendererPluginRegistration = {
	id: "volume-ratio",
	enabled: true,
	async start(ctx) {
		const offBridge = volumeRatioPage.listen(ctx.log);

		const offSettings = ctx.ytmd?.on("settingsProvider.change", (key, value) => {
			if (key === SETTING_KEY && value === true) {
				forceUpdateVolume();
				return;
			}
			if (key === "volumeRatio" && value && typeof value === "object" && (value as { enabled?: boolean }).enabled === true) {
				forceUpdateVolume();
			}
		});

		try {
			const v = await ctx.ytmd?.settings.get(SETTING_KEY);
			if (v === true) forceUpdateVolume();
		} catch {
			/* ignore */
		}

		return () => {
			offBridge();
			offSettings?.();
		};
	},
	onPlayerApiReady(playerApi, ctx) {
		void ctx.ytmd?.settings.get(SETTING_KEY).then((v) => {
			if (v !== true) return;
			try {
				playerApi.setVolume(playerApi.getVolume());
			} catch {
				/* ignore */
			}
		});
	},
};

export default volumeRatioRenderer;

export { disableScriptContent, enableScriptContent };
