import definePlugin from "@plugins/utils";
import { apiControlPluginCmds } from "./api-controls.page";
import apiControlsRenderer from "./api-controls.renderer";
import { startYtmStoreHook } from "./api-controls.store";

export default definePlugin(
	"api-controls",
	{
		enabled: true,
		displayName: "API controls",
		service: "api",
	},
	{
		renderer: apiControlsRenderer,
		afterInit({ log, domUtils }) {
			startYtmStoreHook({ log, domUtils });
		},
		cmds: apiControlPluginCmds,
	},
);
