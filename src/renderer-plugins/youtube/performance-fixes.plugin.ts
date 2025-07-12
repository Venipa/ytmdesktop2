import { injectCpuTamer } from "@plugins/scripts/cpu-tamer";
import { injectRm3 } from "@plugins/scripts/rm3";
import definePlugin from "@plugins/utils";

export default definePlugin(
	"youtube-performance-fixes",
	{
		displayName: "YouTube Performance Fixes",
		enabled: true,
	},
	() => {
		// credits: https://github.com/th-ch/youtube-music/tree/master/src/plugins/performance-improvement
		injectRm3();
		injectCpuTamer();
		// credits end
	},
);
