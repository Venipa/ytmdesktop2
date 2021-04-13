import { ipcMain } from "electron";
import { debounce } from "lodash-es";
const classStoreSymbol = Symbol("__ipcEvents");
interface IpcContextEvent {
  name: string;
  isOnce: boolean;
  debounce?: number
}
export function IpcContext<T extends { new (...args: any[]): {} }>(
  IpcContextBase: T
) {
  return class extends IpcContextBase {
    constructor(...args: any[]) {
      super(...args);
      const symbols: any = IpcContextBase.prototype[classStoreSymbol];
      if (symbols) {
        symbols.forEach(({ name, isOnce, debounce: debounceMs }: IpcContextEvent, method: string) => {
          const func = (...args: any[]) => {
            if (typeof (this as any)[method] === 'function') (this as any)[method](...args);
          };
          ipcMain[isOnce ? "once" : "on"](name, debounceMs ? debounce(func, debounceMs!) : func);
        });
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
      isOnce: true,
    });
  };
}
export function IpcOn(event: string, debounce?: number): MethodDecorator {
  return function<T>(
    target: any,
    propertyKey: string | symbol,
    descriptor?: TypedPropertyDescriptor<T>
  ) {
    target[classStoreSymbol] = target[classStoreSymbol] || new Map();
    target[classStoreSymbol].set(propertyKey, <IpcContextEvent>{
      name: event,
      isOnce: false,
      debounce
    });
  };
}
