import logger from "@/utils/Logger";
import { App, ipcMain, IpcMainEvent, IpcMainInvokeEvent } from "electron";
import { Logger } from "winston";
import { BaseProvider } from "./baseProvider";
import { serverMain } from "./serverEvents";
export interface OnEventExecute {
  execute: (
    ev: IpcMainEvent | any,
    ...args: any[]
  ) => Promise<any> | any | void;
}
export interface OnEventHandle {
  handle: (ev: IpcMainInvokeEvent, ...args: any[]) => Promise<any> | any;
}
export interface IBaseEvent {
  readonly eventName: string;
  readonly logger: Logger;
  readonly getProvider: <T>(name: string) => BaseProvider & T;
  readonly app: App;
}

export class BaseEvent implements IBaseEvent {
  private __type: "on" | "once" | "handle";
  private _loggerInstance: Logger;
  private _providers: { [key: string]: BaseProvider & any } = {};
  private _app: App;
  get eventName() {
    return this._eventName;
  }
  get logger() {
    return this._loggerInstance;
  }
  get app() {
    return this._app;
  }
  getProvider<T>(name: string): BaseProvider & T {
    return this._providers[name] as any;
  }
  __registerProviders(p: BaseProvider[]) {
    this._providers = p.reduce((l, r) => ({ ...l, [r.getName()]: r }), {});
  }
  __registerApp(app: App) {
    this._app = app;
  }
  constructor(
    private _eventName: string,
    type: "on" | "once" | "handle" = "on"
  ) {
    if (!["on", "once", "handle"].includes(type)) {
      throw new Error(`Invalid event type ${type}`);
    }
    this._loggerInstance = logger.child({ moduleName: `event/${_eventName}` });
    this.__type = type;
  }

  __prepare() {
    const type = this.__type;
    const func = (...args: any[]) => {
      return type === "handle"
        ? Promise.resolve((this as any)["handle"](...args))
        : (this as any)["execute"](...args);
    };
    this.logger.debug(`registered "${this.__type}" event "${this.eventName}"`);
    serverMain[type](this.eventName, func);
  }
}
