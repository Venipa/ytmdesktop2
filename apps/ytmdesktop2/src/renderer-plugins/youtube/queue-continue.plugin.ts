import definePlugin from "@plugins/utils";
import queueContinueRenderer from "./queue-continue.renderer";

/** Prefetch YTM queue continuation before the loaded batch ends (#267). */
export default definePlugin(
	"queue-continue",
	{
		enabled: true,
		displayName: "Queue continue",
	},
	{
		renderer: queueContinueRenderer,
	},
);
