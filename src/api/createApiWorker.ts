import { EMPTY_URL, isDevelopment } from "@/app/utils/devUtils";
import logger from "@/utils/Logger";
import { BrowserWindow, ipcMain } from "electron";
import path from "path";
import { apiChannelName } from "./apiWorkerHelper";
export interface ApiWorker {
  send(name: string, ...args: any[]): void;
  invoke<T = any>(name: string, ...args: any[]): Promise<T>;
  destroy(): void;
  rendererId: number;
}
export const createApiWorker = async (): Promise<ApiWorker> => {
  const workerSource = path.join(__dirname, "api.js");
  logger.debug("Worker Added", workerSource);
  const worker = new BrowserWindow({
    show: false,
    closable: false,
    frame: false,
    height: 0,
    width: 0,
    maximizable: false,
    paintWhenInitiallyHidden: false,
    webPreferences: {
      nodeIntegration: true,
      devTools: isDevelopment,
      backgroundThrottling: false,
      disableBlinkFeatures: "*",
      disableDialogs: true,
      disableHtmlFullscreenWindowResize: true,
      preload: workerSource,
    },
  });
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
        ipcMain.once(`${apiChannelName}/${name}`, (ev, data) => resolve(data));
        worker.webContents.send(apiChannelName, name, ...args);
      });
    }
    destroy() {
      if (!worker.isDestroyed()) worker.destroy();
    }
  })();
};
