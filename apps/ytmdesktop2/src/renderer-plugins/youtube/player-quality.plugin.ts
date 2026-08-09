import definePlugin from "@plugins/utils";
import playerQualityRenderer from "./player-quality.renderer";

/** Preferred quality localStorage write runs in page world (world-0 host). */
export default definePlugin(
	"player-quality",
	{
		enabled: true,
		displayName: "Preferred quality",
	},
	{
		renderer: playerQualityRenderer,
	},
);
