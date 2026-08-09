import {
	forceUpdateVolume,
	volumeRatioPage,
} from "./volume-ratio.page";
import { disableVolumeRatio, enableVolumeRatio } from "./resources/volume-ratio/patch";
import type { RendererPluginRegistration } from "./world0/types";

const SETTING_KEY = "volumeRatio.enabled";

function applyEnabled(enabled: boolean): void {
	if (enabled) enableVolumeRatio();
	else disableVolumeRatio();
	forceUpdateVolume();
}

/**
 * Page-world: exponential volume patch + playerApi.setVolume bridge.
 */
const volumeRatioRenderer: RendererPluginRegistration = {
	id: "volume-ratio",
	enabled: true,
	async start(ctx) {
		const offBridge = volumeRatioPage.listen(ctx.log);

		const offSettings = ctx.ytmd?.on("settingsProvider.change", (key, value) => {
			if (key === SETTING_KEY) {
				applyEnabled(value === true);
				return;
			}
			if (key === "volumeRatio" && value && typeof value === "object") {
				applyEnabled((value as { enabled?: boolean }).enabled === true);
			}
		});

		try {
			const v = await ctx.ytmd?.settings.get(SETTING_KEY);
			if (v === true) applyEnabled(true);
		} catch {
			/* ignore */
		}

		return () => {
			offBridge();
			offSettings?.();
			disableVolumeRatio();
		};
	},
	onPlayerApiReady(playerApi, ctx) {
		void ctx.ytmd?.settings.get(SETTING_KEY).then((v) => {
			if (v !== true) return;
			try {
				enableVolumeRatio();
				playerApi.setVolume(playerApi.getVolume());
			} catch {
				/* ignore */
			}
		});
	},
};

export default volumeRatioRenderer;
