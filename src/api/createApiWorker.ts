import { EMPTY_URL, isDevelopment } from "@/app/utils/devUtils";
import { serverMain } from "@/app/utils/serverEvents";
import logger from "@/utils/Logger";
import { BrowserWindow } from "electron";
import path from "path";
import { apiChannelName } from "./apiWorkerHelper";
export interface ApiWorker {
  send(name: string, ...args: any[]): void;
  invoke<T = any>(name: string, ...args: any[]): Promise<T>;
  destroy(): void;
  rendererId: number;
}
export const createApiWorker = async (
  parent?: BrowserWindow
): Promise<ApiWorker> => {
  const workerSource = path.join(__dirname, "api.js");
  logger.debug("Worker Added", workerSource);
  const worker = new BrowserWindow({
    show: false,
    closable: false,
    focusable: false,
    frame: false,
    height: 0,
    width: 0,
    maximizable: false,
    paintWhenInitiallyHidden: false,
    webPreferences: {
      nodeIntegration: true,
      devTools: isDevelopment,
      contextIsolation: false,
      nodeIntegrationInWorker: true,
      backgroundThrottling: false,
      disableBlinkFeatures: "*",
      disableDialogs: true,
      disableHtmlFullscreenWindowResize: true,
      enablePreferredSizeMode: false,
      webgl: false,
      preload: workerSource,
      allowRunningInsecureContent: true
    },
    parent,
  });
  if (parent) parent.on("close", () => worker.destroy());
  await worker.loadURL(EMPTY_URL);

  if (isDevelopment) worker.webContents.openDevTools();
  return new (class {
    constructor() {}
    send(name: string, ...args: any[]) {
      worker.webContents.send(apiChannelName, name, ...args);
    }
    get rendererId() {
      return worker.id;
    }
    invoke<T = any>(name: string, ...args: any[]) {
      return new Promise<T>((resolve) => {
        serverMain.once(`${apiChannelName}/${name}`, (ev, data) => resolve(data));
        worker.webContents.send(apiChannelName, name, ...args);
      });
    }
    destroy() {
      if (!worker.isDestroyed()) worker.destroy();
    }
  })();
};
