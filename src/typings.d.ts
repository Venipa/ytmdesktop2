declare const __static: any;
declare global {
  interface Window {
    api: {
      version: string,
      settings: {
        open(): void;
        close(): void;
      },
      settingsProvider: {
        get<T>(key: string, defaultValue?: T): Promise<T>;
        set(key: string, value: T): Promise<void>;
      },
      emit: (event, ...data) => void,
      emitTo: (id, event, ...data) => void,
      on: (channel, func) => void,
    }
  }
}