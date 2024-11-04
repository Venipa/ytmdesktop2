import { ipcMain } from "electron";
import EventEmitter from "events";

type Listener = (...args: any[]) => void;
/**
 * allows sending ipc main to ipc main
 */
class ElectronEmitter extends EventEmitter {
  constructor() {
    super();
  }
  override on(type: string, listener: Listener): this {
    super.on(type, listener);
    ipcMain.on(type, listener);
    return this;
  }
  override once(type: string, listener: Listener): this {
    super.once(type, listener);
    ipcMain.once(type, listener);
    return this;
  }
  override emit(type: string, ...args: any[]): boolean {
    const validEmit = super.emit(type, ...args);
    const validIpcEmit = ipcMain.emit(type, ...args);
    return validEmit && validIpcEmit;
  }
  emitServer(type: string, ...args: any[]): boolean {
    const validEmit = super.emit(type, ...args);
    return validEmit;
  }
  onServer(type: string, listener: Listener): this {
    super.on(type, listener);
    return this;
  }
  handle: typeof ipcMain.handle = (type: string, listener: Listener) => {
    return ipcMain.handle(type, listener);
  };
}
const serverMain = new ElectronEmitter();

export { serverMain };
