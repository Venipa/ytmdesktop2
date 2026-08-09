import definePlugin from "@plugins/utils";
import trackLikeRenderer from "./track-like.renderer";

/** Like/dislike watch + skip-disliked run in page world (world-0 host). */
export default definePlugin(
	"track-like",
	{
		enabled: true,
		displayName: "Track like",
	},
	{
		renderer: trackLikeRenderer,
	},
);
