import definePlugin from "@plugins/utils";
import shareLinksRenderer from "./share-links.renderer";

/** Share-link rewrite runs in page world (world-0 host). */
export default definePlugin(
	"share-links",
	{
		enabled: true,
		displayName: "Share links",
	},
	{
		renderer: shareLinksRenderer,
	},
);
