import { Logger, createLogger } from "@shared/utils/console";
import { waitMs } from "@shared/utils/promises";
import { App, BrowserWindow, WebContentsView } from "electron";
import { BaseProviderNames } from "ytmd";
import { stringifyJson } from "../lib/json";
import { BrowserWindowViews } from "./mappedWindow";

export interface BeforeStart {
	BeforeStart(app?: App): void | Promise<void>;
}
export interface OnInit {
	OnInit(app: App): void | Promise<void>;
}
export interface AfterInit {
	AfterInit(app: App): void | Promise<void>;
}
export interface OnDestroy {
	OnDestroy(app: App): void | Promise<void>;
}
export type ProviderNameKey = keyof BaseProviderNames | ({} & string);
export class BaseProvider<TView extends WebContentsView = WebContentsView> {
	__type = "service_provider";
	private _providers: { [key: string]: BaseProvider & any } = {};
	private _loggerInstance: Logger;
	private _views!: BrowserWindowViews<{
		youtubeView: TView;
		toolbarView: TView;
		settingsWindow?: BrowserWindow;
		miniPlayerWindow?: BrowserWindow;
		taskViewWindow?: BrowserWindow;
	}>;
	get logger() {
		return this._loggerInstance;
	}
	log(...args: any) {
		return this._loggerInstance.debug(stringifyJson([...args]));
	}
	get views() {
		return this._views.views;
	}
	get windowContext() {
		return this._views;
	}
	constructor(
		private name: ProviderNameKey,
		private displayName: string = name,
	) {
		this._loggerInstance = createLogger("services").child(this.name);
	}
	private async _ytmReady(retryCount: number = 0) {
		if (!this.views.youtubeView) return false;
		if (this.views.youtubeView.webContents.isDestroyed()) return false;
		if (this.views.youtubeView.webContents.isCrashed()) return false;
		if (this.views.youtubeView.webContents.isLoading()) await new Promise<void>((resolve) => this.views.youtubeView.webContents.on("did-finish-load", resolve));
		const isReady = await this.views.youtubeView.webContents.executeJavaScript(`(window && window.isYTMLoaded && window.isYTMLoaded())`);
		this.logger.debug("YTM ready:", isReady, { retryCount });
		if (!isReady && retryCount > 20) throw new Error("YTM was not able to initialize");
		if (!isReady) return await waitMs(500).then(() => this._ytmReady(retryCount + 1));
		return isReady;
	}
	async isYtmReady() {
		return await this._ytmReady(0);
	}
	getName() {
		return this.name;
	}
	getDisplayName() {
		return this.displayName;
	}
	__registerProviders(p: BaseProvider[]) {
		this._providers = p.reduce((l, r) => ({ ...l, [r.getName()]: r }), {});
	}
	__registerWindows(views: BrowserWindowViews<any> = {} as BrowserWindowViews<any>) {
		this._views = views;
	}
	getProvider<T extends BaseProviderNames[K], K extends keyof BaseProviderNames & string>(name: K): T {
		return (this._providers as BaseProviderNames)[name] as T;
	}
	queryProvider(): BaseProvider[] {
		return Object.values(this._providers);
	}
}
