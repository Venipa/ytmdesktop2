import translations from "@/translations";
import { BrowserView, BrowserWindow, BrowserWindowConstructorOptions, ipcMain } from "electron";
import { resolve } from "path";
import { defaultUrl, isDevelopment } from "./devUtils";
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
  const webPreferences: Electron.WebPreferences = {
    nodeIntegration: false,
    nodeIntegrationInSubFrames: false,
    nodeIntegrationInWorker: false,
    webSecurity: false,
    sandbox: false,
    contextIsolation: true,
    allowRunningInsecureContent: false,
    preload: parseScriptPath("preload-login.js"),
  };
  const popup = await createPopup({
    icon: appIconPath,
    title: translations.appName,
    height: 580,
    width: 800,
    resizable: false,
    maximizable: false,
    frame: false,
    fullscreenable: false,
    minimizable: false,
    alwaysOnTop: true,
    autoHideMenuBar: true,
    webPreferences,
    ...(parent && { parent, modal: true } || {})
  });
  popup.setMenu(null);
  const secureBrowserHeaders = `User-Agent: ${GoogleUA}`;
  const noticeView = await createApiView("youtube/login-notice");
  popup.addBrowserView(noticeView);
  const [width, height] = popup.getContentSize();
  const noticeHeight = 120;
  noticeView.setBounds({ height: noticeHeight, width, x: 0, y: 0 });
  noticeView.setAutoResize({ width: true });
  const loginView = new BrowserView({
    webPreferences
  });
  popup.addBrowserView(loginView);
  loginView.setBounds({ height: height - noticeHeight, width, x: 0, y: noticeHeight });
  loginView.setAutoResize({ width: true });
  popup.setTopBrowserView(loginView);
  loginView.webContents.setUserAgent(GoogleUA);
  await loginView.webContents.loadURL(authUrl, {
    userAgent: GoogleUA,
    httpReferrer: defaultUrl
  });
  loginView.webContents.setUserAgent(GoogleUA);
  loginView.webContents.session.webRequest.onBeforeSendHeaders(
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
  if (isDevelopment) {

    loginView.webContents.openDevTools({ mode: "detach" });
    noticeView.webContents.openDevTools({ mode: "detach" })
  }

  let timeoutHandler: NodeJS.Timeout; // timeout after 10 minutes
  const clearGC = () => {
    timeoutHandler && clearTimeout(timeoutHandler);
  }
  ipcMain.once("subwindow.close/loginView", () => {
    popup.close();
    clearGC();
  })
  return await new Promise<boolean>((resolve, reject) => {
    timeoutHandler = setTimeout(() => {
      reject();
    }, 10 * 60 * 1000);
    let isAuthenticated = false;
    popup.on("close", () => {
      resolve(isAuthenticated);
      clearGC();
    });
    loginView.webContents.on("ipc-message", (ev, eventName) => {
      console.log("login event", eventName);
      if (eventName === "g-login-success") {
        isAuthenticated = true;
        popup.close();
      }
    })
  })
}
