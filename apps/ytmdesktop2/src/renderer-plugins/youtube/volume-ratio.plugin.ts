import definePlugin from "@plugins/utils";
import { volumeRatioPage } from "./volume-ratio.page";
import volumeRatioRenderer from "./volume-ratio.renderer";

/**
 * Boot enable lives in page renderer (settings.get on start).
 * Preload afterInit must not bridge-request — world0 `listen` can still be racing.
 * Toggle / IPC: cmds -> page `enable` / `disable` / `forceUpdate`.
 */
export default definePlugin(
	"volume-ratio",
	{
		enabled: true,
		displayName: "Volume ratio",
	},
	{
		renderer: volumeRatioRenderer,
		cmds: {
			...volumeRatioPage.pluginCmds,
		},
	},
);
