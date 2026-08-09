import { BrowserWindowViews } from "@main/windows/mappedWindow";
import { YtmClient } from "@main/ytm/ytm-client";
import { createLogger, Logger } from "@shared/utils/console";
import type { YtmCmdTarget } from "@shared/ytm";
import { App, BrowserWindow, WebContentsView } from "electron";
import type { ProviderNameKey } from "ytmd";
import { BaseProviderNames } from "ytmd";
import { stringifyJson } from "../lib/json";

export interface BeforeStart {
	BeforeStart(app?: App): void | Promise<void>;
}
export interface OnInit {
  /**
   * Called when the provider is initialized.
   * This is called after the electron app is ready.
   * @param app 
   */
	OnInit(app: App): void | Promise<void>;
}
export interface AfterInit {
	AfterInit(app: App): void | Promise<void>;
}
export interface OnDestroy {
	OnDestroy(app: App): void | Promise<void>;
}
export class BaseProvider<TView extends WebContentsView = WebContentsView> {
	__type = "service_provider";
	private _providers: { [key: string]: BaseProvider & any } = {};
	private _loggerInstance: Logger;
	private _views!: BrowserWindowViews<{
		youtubeView: TView;
		toolbarView: TView;
		settingsWindow?: BrowserWindow;
		trayViewWindow?: BrowserWindow;
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
	private async _ytmReady() {
		if (!this.views.youtubeView) return false;
		if (this.views.youtubeView.webContents.isDestroyed()) return false;
		if (this.views.youtubeView.webContents.isCrashed()) return false;
		const isReady = await YtmClient.isReady({ timeout: 12_000, requirePlayer: true, requireLoaded: true });
		this.logger.debug("YTM ready:", isReady);
		if (!isReady) throw new Error("YTM was not able to initialize");
		return isReady;
	}

	async executeCommand<T = unknown>(command: string, ...args: any[]): Promise<T> {
		const target = this.name as YtmCmdTarget;
		return await YtmClient.cmd<T>(target, command, ...args);
	}
	async isYtmReady() {
		return await this._ytmReady();
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
