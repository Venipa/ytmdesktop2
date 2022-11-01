import { BrowserView } from "electron";
import { resolve } from "path";
export const createApiView = async (path: string, postFunc?: (ctx: BrowserView) => Promise<void> | void): Promise<BrowserView> => {
  const view = new BrowserView({
    webPreferences: {
      nodeIntegration: process.env.ELECTRON_NODE_INTEGRATION === "true",
      sandbox: false,
      contextIsolation: true,
      preload: resolve(__dirname, "preload-api.js")
    },
  });
  await view.webContents.loadURL(
    (process.env.WEBPACK_DEV_SERVER_URL
      ? process.env.WEBPACK_DEV_SERVER_URL
      : "app://./index.html/"
    ).concat(`#${path}`)
  );
  if (postFunc) await Promise.resolve(postFunc(view));
  return view;
};
export const createView = async (preload: string, postFunc?: (ctx: BrowserView) => Promise<void> | void): Promise<BrowserView> => {
  const view = new BrowserView({
    webPreferences: {
      disableHtmlFullscreenWindowResize: true,
      nodeIntegration: process.env.ELECTRON_NODE_INTEGRATION === "true",
      sandbox: false,
      contextIsolation: false, // window object is required to be rewritten for tracking current track
      preload,
    },
  });
  if (postFunc) await Promise.resolve(postFunc(view));
  return view;
};
