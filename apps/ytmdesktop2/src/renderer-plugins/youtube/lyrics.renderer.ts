import { lyricsPage } from "./lyrics.page";
import type { RendererPluginRegistration } from "./world0/types";

const lyricsRenderer: RendererPluginRegistration = {
	id: "lyrics",
	enabled: true,
	async start(ctx) {
		return lyricsPage.listen(ctx.log);
	},
};

export default lyricsRenderer;
