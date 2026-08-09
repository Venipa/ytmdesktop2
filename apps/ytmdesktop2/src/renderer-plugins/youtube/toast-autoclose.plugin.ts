import definePlugin from "@plugins/utils";
import toastAutocloseRenderer from "./toast-autoclose.renderer";

/** Toast auto-close runs in page world (world-0 host). */
export default definePlugin(
	"toast-autoclose",
	{ enabled: true, displayName: "Toast auto-close" },
	{
		renderer: toastAutocloseRenderer,
	},
);
