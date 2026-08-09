import definePlugin from "@plugins/utils";
import perfFixesRenderer from "./perf-fixes.renderer";

/** rm3 + cpu-tamer run in page world (world-0 host). */
export default definePlugin(
	"perf-fixes",
	{
		displayName: "Performance fixes",
		enabled: true,
	},
	{
		renderer: perfFixesRenderer,
	},
);
