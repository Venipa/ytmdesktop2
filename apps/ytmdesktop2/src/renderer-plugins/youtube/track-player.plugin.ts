import definePlugin from "@plugins/utils";
import trackPlayerRenderer from "./track-player.renderer";

/** Track info, playback, and early title videoId in page world. */
export default definePlugin(
	"track-player",
	{
		enabled: true,
		displayName: "Track player",
	},
	{
		renderer: trackPlayerRenderer,
	},
);
