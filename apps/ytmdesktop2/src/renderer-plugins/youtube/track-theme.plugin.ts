import definePlugin from "@plugins/utils";
import trackThemeRenderer from "./track-theme.renderer";

/** Thumbnail / accent CSS vars applied in page world (world-0 host). */
export default definePlugin(
	"track-theme",
	{
		enabled: true,
		displayName: "Track theme CSS",
	},
	{
		renderer: trackThemeRenderer,
	},
);
