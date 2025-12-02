import { logger } from "@shared/utils/console";
import { WebContents } from "electron";
import { compileStringAsync } from "sass";
type CSSHandlerOptions = { translateSass: boolean };
export default class CSSHandler {
	private logger = logger.child("CSSHandler");
	private css: string;
	private cssId: string;
	constructor(
		private webContents: WebContents,
		private options: CSSHandlerOptions = { translateSass: false },
	) {}
	get isCreated() {
		return !!this.cssId;
	}
	async createOrUpdate(css: string) {
		if (this.cssId) await this.remove();
		if (!css) throw new Error("CSS is required");
		this.css = this.options.translateSass ? await compileStringAsync(css).then((result) => result.css) : css;
		this.cssId = await this.webContents.insertCSS(this.css);
		this.logger.debug("CSS inserted", { cssId: this.cssId, css: this.css });
		return this.cssId;
	}
	async remove() {
		if (!this.cssId) throw new Error("CSS not found");
		this.css = null;
		await this.webContents.removeInsertedCSS(this.cssId);
		this.cssId = null;
	}
}
