import definePlugin from "@plugins/utils";
import {
	postVolumeRatioForceUpdate,
	requestVolumeRatioForceUpdate,
	volumeRatioPage,
} from "./volume-ratio.page";
import volumeRatioRenderer, {
	disableScriptContent,
	enableScriptContent,
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
				return requestVolumeRatioForceUpdate();
			},
			async disable({ log, domUtils }) {
				log.debug("Disabling volume ratio");
				await domUtils.createAndRunScript(disableScriptContent, "volume-ratio-disable");
				return requestVolumeRatioForceUpdate();
			},
			...volumeRatioPage.pluginCmds,
		},
	},
);
