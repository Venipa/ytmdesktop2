import definePlugin from "@plugins/utils";
import { inject } from "simple-youtube-age-restriction-bypass";

export default definePlugin(
	"bypass-age-restrictions",
	{
		enabled: true,
		displayName: "Bypass Age Restrictions",
		restartNeeded: true,
	},
	({ pluginSettings, onSettingsChange }) => {
		if (pluginSettings.enabled) {
			inject();
		}
	},
);
