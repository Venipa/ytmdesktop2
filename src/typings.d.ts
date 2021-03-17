declare const __static: any;
declare global {
  interface Window {
    app: {
      version: string,
      settings: {
        open(): void;
        close(): void;
      },
      settingsProvider: {
        get<T>(key: string, defaultValue?: T): Promise<T>;
        set(key: string, value: T): Promise<void>;
      }
    }
  }
}