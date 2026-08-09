import { apiControlsPage } from "./api-controls.page";
import type { RendererPluginRegistration } from "./world0/types";

const apiControlsRenderer: RendererPluginRegistration = {
	id: "api-controls",
	enabled: true,
	async start(ctx) {
		return apiControlsPage.listen(ctx.log);
	},
};

export default apiControlsRenderer;
