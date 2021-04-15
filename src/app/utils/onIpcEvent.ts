import { ipcMain, IpcMainEvent, IpcMainInvokeEvent } from "electron";
import { debounce } from "lodash-es";
const classStoreSymbol = Symbol("__ipcEvents");
interface IpcContextEvent {
  name: string;
  type?: "once" | "handle";
  options?: {
    debounce?: number;
    filter?: (ev: IpcMainEvent | IpcMainInvokeEvent, ...args: any[]) => boolean;
  };
}
export function IpcContext<T extends { new (...args: any[]): {} }>(
  IpcContextBase: T
) {
  return class extends IpcContextBase {
    constructor(...args: any[]) {
      super(...args);
      const symbols: any = IpcContextBase.prototype[classStoreSymbol];
      if (symbols) {
        symbols.forEach(
          ({ name, type, options }: IpcContextEvent, method: string) => {
            const func = (...args: any[]) => {
              if (
                typeof (this as any)[method] === "function" &&
                (typeof options?.filter === "function"
                  ? options?.filter(args[0], ...args.slice(1))
                  : true)
              )
                return type === "handle"
                  ? Promise.resolve((this as any)[method](...args))
                  : (this as any)[method](...args);
            };
            ipcMain[
              type === "once" ? "once" : type === "handle" ? "handle" : "on"
            ](
              name,
              options?.debounce ? debounce(func, options.debounce!) : func
            );
          }
        );
      }
    }
  };
}

export function IpcOnce(event: string): MethodDecorator {
  return function<T>(
    target: any,
    propertyKey: string | symbol,
    descriptor?: TypedPropertyDescriptor<T>
  ) {
    target[classStoreSymbol] = target[classStoreSymbol] || new Map();
    target[classStoreSymbol].set(propertyKey, <IpcContextEvent>{
      name: event,
      type: "once",
    });
  };
}
export function IpcOn(
  event: string,
  options?: {
    debounce?: number;
    filter?: (ev: IpcMainEvent, ...args: any[]) => boolean;
  }
): MethodDecorator {
  return function<T>(
    target: any,
    propertyKey: string | symbol,
    descriptor?: TypedPropertyDescriptor<T>
  ) {
    target[classStoreSymbol] = target[classStoreSymbol] || new Map();
    target[classStoreSymbol].set(propertyKey, <IpcContextEvent>{
      name: event,
      options,
    });
  };
}
export function IpcHandle(
  event: string,
  options?: {
    debounce?: number;
    filter?: (ev: IpcMainEvent, ...args: any[]) => boolean;
  }
): MethodDecorator {
  return function<T>(
    target: any,
    propertyKey: string | symbol,
    descriptor?: TypedPropertyDescriptor<T>
  ) {
    target[classStoreSymbol] = target[classStoreSymbol] || new Map();
    target[classStoreSymbol].set(propertyKey, <IpcContextEvent>{
      name: event,
      type: "handle",
      options,
    });
  };
}
