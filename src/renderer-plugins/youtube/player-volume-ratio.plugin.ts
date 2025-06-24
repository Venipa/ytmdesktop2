// This file is a slightly edited version of of the script found here:
// https://greasyfork.org/en/scripts/397686-youtube-music-fix-volume-ratio
// Made by: Marco Pfeiffer <git@marco.zone>

import disableScriptContent from "@main/services/resources/volume-ratio/disable-script.js?raw";
import enableScriptContent from "@main/services/resources/volume-ratio/enable-script.js?raw";
import definePlugin from "@plugins/utils";

export default definePlugin(
	"player-volume-ratio",
	{
		enabled: true,
		displayName: "Youtube Player Volume Ratio Handler",
	},
	{
		afterInit({ settings, domUtils, log, playerApi }) {
			if (!settings.volumeRatio?.enabled) return;
			domUtils.ensureWindowLoaded(async () => {
				await domUtils.createAndRunScript(enableScriptContent, "player-volume-ratio-enable");

				playerApi.setVolume(playerApi.getVolume());
				log.debug("Volume ratio enabled");
			});
		},
		cmds: {
			async enable({ name, log, domUtils }) {
				log.debug("Enabling volume ratio", name);
				domUtils.ensureDomLoaded(() => {
					domUtils.createAndRunScript(enableScriptContent, "player-volume-ratio-enable");
				});
			},
			async disable({ name, log, domUtils }) {
				log.debug("Disabling volume ratio", name);
				domUtils.ensureDomLoaded(() => {
					domUtils.createAndRunScript(disableScriptContent, "player-volume-ratio-disable");
				});
			},
			async forceUpdate({ playerApi, api, log }, [volume]: [number]) {
				playerApi.setVolume((volume = volume ?? playerApi.getVolume()));
				log.debug("Force updated volume ratio", volume);
				return volume;
			},
		},
	},
);
