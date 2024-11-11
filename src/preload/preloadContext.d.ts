import type pd from "./base";
interface PreloadContext {
  api: typeof pd.api;
  domUtils: typeof pd.domUtils;
  ipcRenderer: typeof pd.ipcRenderer;
  process: typeof pd.process;
  __ytd_plugins: any;
  __ytd_settings: any;
  __initYTMD: () => Promise<void>;
  isYTMLoaded: () => boolean;
}
declare global {
  declare const __dirname: string;
  interface Window extends globalThis, PreloadContext {
    [key: string]: any;
  }
}
