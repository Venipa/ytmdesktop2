import logger from "@/utils/Logger";
import { App } from "electron";
import { BrowserView } from "electron/main";
import { Logger } from "winston";
import { BrowserWindowViews } from "../utils/mappedWindow";
export interface BeforeStart {
  BeforeStart(): void | Promise<void>;
}
export interface OnInit {
  OnInit(app?: App): void | Promise<void>;
}
export interface AfterInit {
  AfterInit(app?: App): void | Promise<void>;
}
export interface OnDestroy {
  OnDestroy(app?: App): void | Promise<void>;
}

export class BaseProvider {
  __type = "service_provider";
  private __providers: { [key: string]: BaseProvider & any } = {};
  private _loggerInstance: Logger;
  private _views: BrowserWindowViews<{ youtubeView: BrowserView }>;
  get logger() {
    return this._loggerInstance;
  }
  get views() {
    return this._views.views;
  }
  constructor(private name: string, private displayName: string = name) {
    this._loggerInstance = logger.child({ label: displayName || name })
  }

  getName() {
    return this.name;
  }
  getDisplayName() {
    return this.displayName;
  }
  _registerProviders(p: BaseProvider[]) {
    this.__providers = p.reduce((l, r) => ({ ...l, [r.getName()]: r }), {});
  }
  _registerWindows(views: BrowserWindowViews<{ youtubeView: BrowserView }>) {
    this._views = views;
  }
  getProvider(name: string) {
    return this.__providers[name];
  }
  queryProvider(): BaseProvider[] {
    return Object.values(this.__providers);
  }
}
