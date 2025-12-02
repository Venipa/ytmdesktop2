import { WebContents } from "electron";
import { compileAsync } from "sass";
type CSSHandlerOptions = { translateSass: boolean };
export default class CSSHandler {
	private css: string;
	private cssId: string;
	constructor(
		private webContents: WebContents,
		private options: CSSHandlerOptions = { translateSass: false },
	) {}
	async createOrUpdate(css: string, options?: CSSHandlerOptions) {
		if (this.cssId) await this.remove();
		if (!css) throw new Error("CSS is required");
		this.css = this.options.translateSass ? await compileAsync(css).then((result) => result.css) : css;
		this.cssId = await this.webContents.insertCSS(css, { cssOrigin: "user" });
		return this.cssId;
	}
	async remove() {
		if (!this.cssId) throw new Error("CSS not found");
		this.css = null;
		await this.webContents.removeInsertedCSS(this.cssId);
		this.cssId = null;
	}
}
