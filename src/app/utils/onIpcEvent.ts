import { ipcMain } from "electron";
import { debounce } from "lodash-es";
const classStoreSymbol = Symbol("__ipcEvents");
interface IpcContextEvent {
  name: string;
  type?: 'once' | 'handle';
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
        symbols.forEach(({ name, type, debounce: debounceMs }: IpcContextEvent, method: string) => {
          const func = (...args: any[]) => {
            if (typeof (this as any)[method] === 'function') return type === 'handle' ? Promise.resolve((this as any)[method](...args)) : (this as any)[method](...args);
          };
          ipcMain[type === 'once' ? "once" : type === 'handle' ? 'handle' : "on"](name, debounceMs ? debounce(func, debounceMs!) : func);
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
      type: 'once'
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
      debounce
    });
  };
}
export function IpcHandle(event: string, debounce?: number): MethodDecorator {
  return function<T>(
    target: any,
    propertyKey: string | symbol,
    descriptor?: TypedPropertyDescriptor<T>
  ) {
    target[classStoreSymbol] = target[classStoreSymbol] || new Map();
    target[classStoreSymbol].set(propertyKey, <IpcContextEvent>{
      name: event,
      type: 'handle',
      debounce
    });
  };
}
