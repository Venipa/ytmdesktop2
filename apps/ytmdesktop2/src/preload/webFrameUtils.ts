import type { WebFrame } from "electron";

class RendererCSSHandler {
	private _cssId: string | null = null;
	private _webFrame: WebFrame;
	constructor(webFrame: WebFrame) {
		this._webFrame = webFrame;
	}
	public createOrUpdate(css: string) {
		if (this._cssId) this.remove();
		if (!css) throw new Error("CSS is required");
		this._cssId = this._webFrame.insertCSS(css);
	}
	public remove() {
		if (!this._cssId) throw new Error("CSS not found");
		this._webFrame.removeInsertedCSS(this._cssId);
		this._cssId = null;
	}
}
export interface IRendererCSSHandler {
	createOrUpdate(css: string): void;
	remove(): void;
}
export function createRendererCSSHandler(webFrame: WebFrame): IRendererCSSHandler {
	return new RendererCSSHandler(webFrame);
}
