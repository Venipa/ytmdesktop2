import type pd from "./preload/base";


declare const __static: any;
declare const __dirname: string;
interface PreloadContext {
  api: typeof pd.api;
  ipcRenderer: typeof pd.ipcRenderer;
  process: typeof pd.process;
  __ytd_plugins: any;
  __ytd_settings: any;

}
declare global {
  declare const __static: any;
  declare const __dirname: string;
  interface Window extends globalThis, PreloadContext {
    [key: string]: any;
  }
}
