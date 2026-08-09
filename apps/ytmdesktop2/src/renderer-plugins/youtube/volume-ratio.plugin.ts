import definePlugin from "@plugins/utils";
import volumeRatioRenderer, {
	disableScriptContent,
	enableScriptContent,
	postVolumeRatioForceUpdate,
} from "./volume-ratio.renderer";

export default definePlugin(
	"volume-ratio",
	{
		enabled: true,
		displayName: "Volume ratio",
	},
	{
		renderer: volumeRatioRenderer,
		async afterInit({ settings, domUtils, log }) {
			if (!settings.volumeRatio?.enabled) return;
			await domUtils.createAndRunScript(enableScriptContent, "volume-ratio-enable");
			postVolumeRatioForceUpdate();
			log.debug("volume ratio enabled (preload inject)");
		},
		cmds: {
			async enable({ log, domUtils }) {
				log.debug("Enabling volume ratio");
				await domUtils.createAndRunScript(enableScriptContent, "volume-ratio-enable");
				postVolumeRatioForceUpdate();
			},
			async disable({ log, domUtils }) {
				log.debug("Disabling volume ratio");
				await domUtils.createAndRunScript(disableScriptContent, "volume-ratio-disable");
				postVolumeRatioForceUpdate();
			},
			async forceUpdate({ log }, volume?: number) {
				log.debug("Force updated volume ratio", volume);
				postVolumeRatioForceUpdate(volume);
				return volume;
			},
		},
	},
);
