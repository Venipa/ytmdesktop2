import { ipcMain, WebContentsView } from "electron";

export async function waitMs(ms?: number) {
  return await new Promise<void>((resolve) => setTimeout(resolve, ms));
}
/**
 * custom ipc promise handler
 * @param view view of ipc promise
 * @param channel channel name to send the request to, response channel will be created by suffix "/response"
 * @param args 
 * @returns 
 */
export async function ipcPromise<T = any, R = T>(view: WebContentsView, channel: string, ...args: any[]) {
  let _timeout: any;
  view.webContents.send(channel, ...args);
  return await new Promise<T>((resolve, reject) => {
    const responseChannelName = channel + "/response";
    const handler: any = (_ev: any, data: any) => {
      ipcMain.off(responseChannelName, handler);
      if (_timeout) clearTimeout(_timeout)
      resolve(data as T)
    }
    ipcMain.on(responseChannelName, handler)
    _timeout = setTimeout(() => {
      ipcMain.off(responseChannelName, handler);
      reject(new Error("IPC Promise timeout."))
    }, 10000);
  })
}