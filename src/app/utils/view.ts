import translations from "@/translations";
import { BrowserView, BrowserWindow, BrowserWindowConstructorOptions } from "electron";
import { resolve } from "path";
import { defaultUrl } from "./devUtils";
import { appIconPath, parseScriptPath } from "./windowUtils";
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
export const createPopup = async (options?: BrowserWindowConstructorOptions) => {
  const wnd = new BrowserWindow({
    minHeight: 400,
    minWidth: 400,
    ...(options ? options : {}),
    webPreferences: {
      disableHtmlFullscreenWindowResize: true,
      nodeIntegration: process.env.ELECTRON_NODE_INTEGRATION === "true",
      sandbox: true,
      contextIsolation: false, // window object is required to be rewritten for tracking current track
      ...(options?.webPreferences ? options.webPreferences : {})
    }
  });
  return wnd;
}
export const GoogleUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:98.0) Gecko/20100101 Firefox/98.0";
export const googleLoginPopup = async (authUrl: string, parent?: Electron.BrowserWindow) => {
  const popup = await createPopup({
    icon: appIconPath,
    title: translations.appName,
    height: 680,
    width: 460,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    minimizable: false,
    alwaysOnTop: true,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      nodeIntegrationInSubFrames: false,
      nodeIntegrationInWorker: false,
      webSecurity: true,
      sandbox: true,
      contextIsolation: false,
      allowRunningInsecureContent: false,
      disableHtmlFullscreenWindowResize: true,
      preload: parseScriptPath("preload-login.js"),
    },
    ...(parent && { parent, modal: true } || {})
  });
  popup.setMenu(null);
  const secureBrowserHeaders = `User-Agent: ${GoogleUA}`;
  await popup.loadURL(authUrl, {
    userAgent: GoogleUA,
    httpReferrer: defaultUrl
  });
  popup.webContents.setUserAgent(GoogleUA);
  popup.webContents.session.webRequest.onBeforeSendHeaders(
    {
      urls: ["https://accounts.google.com/*"],
    },
    (details, callback) => {
      secureBrowserHeaders.split("\n").forEach(header => {
        const [key, value] = [header.slice(0, header.indexOf(":"))?.trimStart?.(), header.slice(header.indexOf(":") + 1)?.trimStart?.()]
        console.log("GOOGLE HEADERS: ", key, value);
        if (key)
          details.requestHeaders[key.trimStart()] = value.trimStart();
      })
      callback(details);
    }
  );
  popup.webContents.openDevTools({ mode: "detach" });
  return await new Promise<boolean>((resolve, reject) => {
    const timeoutHandler = setTimeout(() => {
      reject();
    }, 10 * 60 * 1000); // timeout after 10 minutes
    const clearGC = () => {
      clearTimeout(timeoutHandler);
    }
    let isAuthenticated = false;
    popup.on("close", () => {
      resolve(isAuthenticated);
      clearGC();
    });
    popup.webContents.on("ipc-message", (ev, eventName) => {
      console.log("login event", eventName);
      if (eventName === "g-login-success") {
        isAuthenticated = true;
        popup.close();
      }
    })
  })
}
