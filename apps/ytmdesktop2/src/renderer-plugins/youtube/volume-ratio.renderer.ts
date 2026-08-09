import disableScriptContent from "./resources/volume-ratio/disable-script.js?raw";
import enableScriptContent from "./resources/volume-ratio/enable-script.js?raw";
import { getPagePlayerApi } from "./world0/context";
import type { RendererPluginRegistration } from "./world0/types";

const VOLUME_RATIO_MSG = "__ytmd_volume_ratio";
const SETTING_KEY = "volumeRatio.enabled";

function forceUpdateVolume(volume?: number): number | undefined {
	const player = getPagePlayerApi();
	if (!player) return volume;
	const next = volume ?? player.getVolume();
	player.setVolume(next);
	return next;
}

/**
 * Page-world half: playerApi.setVolume only.
 * Enable/disable scripts run from preload via createAndRunScript (Trusted Types safe).
 */
const volumeRatioRenderer: RendererPluginRegistration = {
	id: "volume-ratio",
	enabled: true,
	async start(ctx) {
		const onMessage = (ev: MessageEvent) => {
			const data = ev.data;
			if (!data || typeof data !== "object" || (data as { type?: string }).type !== VOLUME_RATIO_MSG) return;
			const op = (data as { op?: string; volume?: number }).op;
			if (op === "forceUpdate") forceUpdateVolume((data as { volume?: number }).volume);
		};
		window.addEventListener("message", onMessage);

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
			window.removeEventListener("message", onMessage);
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

/** Preload cmds ask page world to refresh volume via playerApi. */
export function postVolumeRatioForceUpdate(volume?: number): void {
	window.postMessage({ type: VOLUME_RATIO_MSG, op: "forceUpdate", volume }, "*");
}

export { disableScriptContent, enableScriptContent };
