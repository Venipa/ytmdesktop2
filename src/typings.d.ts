/* eslint-disable no-unused-vars */
declare const __static: any;
declare const __dirname: string;
interface PreloadContext {
  api: {
    version: string;
    settings: {
      open(): void;
      close(): void;
    };
    settingsProvider: {
      get<T>(key: string, defaultValue?: T): Promise<T>;
      set(key: string, value: T): Promise<void>;
    };
    emit: (event, ...data) => void;
    emitTo: (id, event, ...data) => void;
    on: (channel, func) => void;
  };
}
declare global {
  interface Window extends PreloadContext {
    [key: string]: any;
  }
}
