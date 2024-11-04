import { Event, IpcMainEvent, IpcMainInvokeEvent } from "electron";
import { debounce } from "lodash-es";
import { serverMain } from "./serverEvents";
const classIpcStoreSymbol = Symbol("__ipcEvents");
type IpcFilterOption<T extends Event> = (ev: T, ...args: any[]) => boolean;
interface IpcContextEvent {
  name: string;
  type?: "once" | "handle";
  options?: {
    debounce?: number;
    filter?: IpcFilterOption<IpcMainEvent | IpcMainInvokeEvent> | ((...args: any[]) => boolean);
    passive?: boolean;
  };
}
export function IpcContextWithOptions() {
  return IpcContext; // todo: add options to ipc base to allow setting prefixes to events
}
export function getRegisteredEventNames(classRef: any) {
  return Array.from(classRef)
    ?.filter(([, value]) => Boolean(value))
    .map(([, value]: [string, IpcContextEvent]) => value.name);
}
export function IpcContext<T extends { new (...args: any[]): {} }>(IpcContextBase: T) {
  return class extends IpcContextBase {
    public get __registeredIpcEvents() {
      return this[Object.getOwnPropertySymbols(this)[0]]?.values?.();
    }
    constructor(...args: any[]) {
      super(...args);
      const symbols: any = IpcContextBase.prototype[classIpcStoreSymbol];
      if (symbols) {
        symbols.forEach(({ name, type, options }: IpcContextEvent, method: string) => {
          const func = (...args: any[]) => {
            if (
              typeof (this as any)[method] === "function" &&
              (options && options.filter && typeof options.filter === "function"
                ? options.filter(args[0], ...args.slice(1))
                : true)
            ) {
              return type === "handle"
                ? Promise.resolve((this as any)[method](...args))
                : (this as any)[method](...args);
            }
            return Promise.resolve(null);
          };
          serverMain[type === "once" ? "once" : type === "handle" ? "handle" : "on"](
            name,
            options && options.debounce ? debounce(func, options.debounce) : func,
          );
        });
      }
    }
  };
}

export function IpcOnce(event: string): MethodDecorator {
  return function <T>(
    target: any,
    propertyKey: string | symbol,
    _descriptor?: TypedPropertyDescriptor<T>,
  ) {
    target[classIpcStoreSymbol] = target[classIpcStoreSymbol] || new Map();
    target[classIpcStoreSymbol].set(propertyKey, <IpcContextEvent>{
      name: event,
      type: "once",
    });
  };
}
export function IpcOn(event: string, options?: IpcContextEvent["options"]): MethodDecorator {
  return function <T>(
    target: any,
    propertyKey: string | symbol,
    _descriptor?: TypedPropertyDescriptor<T>,
  ) {
    target[classIpcStoreSymbol] = target[classIpcStoreSymbol] || new Map();
    target[classIpcStoreSymbol].set(propertyKey, <IpcContextEvent>{
      name: event,
      options,
    });
  };
}
export function IpcHandle(event: string, options?: IpcContextEvent["options"]): MethodDecorator {
  return function <T = any>(
    target: any,
    propertyKey: string | symbol,
    _descriptor?: TypedPropertyDescriptor<T>,
  ) {
    target[classIpcStoreSymbol] = target[classIpcStoreSymbol] || new Map();
    target[classIpcStoreSymbol].set(propertyKey, <IpcContextEvent>{
      name: event,
      type: "handle",
      options,
    });
  };
}
