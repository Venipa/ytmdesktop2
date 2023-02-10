import logger from "@/utils/Logger";
import { BrowserWindow, shell } from "electron";
import path from "path";
import { isDevelopment } from "./devUtils";
type WindowOptions = {
  path: string;
  parent: BrowserWindow;
  minHeight?: number;
  minWidth?: number;
  maxHeight?: number;
  maxWidth?: number;
  height?: number;
  width?: number;
  top?: boolean
};
const log = logger.child({ label: "main" });
export function parseScriptPath(p: string) {
  return path.resolve(__dirname, p);
}
export const appIconPath = path.resolve(__static, "favicon.ico");
export async function createAppWindow(appOptions?: Partial<WindowOptions>) {
  // eslint-disable-next-line prefer-const
  let { parent, path, minHeight, minWidth, maxHeight, maxWidth, height, width, top } = appOptions ?? {};
  if (!path) path = "/";
  // Create the browser window.
  const win = new BrowserWindow({
    width: width ?? 800,
    height: height ?? 600,
    minWidth: minWidth ?? 800,
    minHeight: minHeight ?? 480,
    maxWidth,
    maxHeight,
    minimizable: false,
    backgroundColor: "#000000",
    fullscreenable: !maxWidth && !maxWidth,
    icon: appIconPath,
    frame: false,
    parent,
    modal: parent && top === true,
    darkTheme: true,
    webPreferences: {
      // Use pluginOptions.nodeIntegration, leave this alone
      // See nklayman.github.io/vue-cli-plugin-electron-builder/guide/security.html#node-integration for more info
      nodeIntegration: process.env.ELECTRON_NODE_INTEGRATION === "true",
      contextIsolation: true,
      preload: parseScriptPath("preload-api.js"),
    },
  });
  if (process.env.WEBPACK_DEV_SERVER_URL) {
    log.debug("dev url:", process.env.WEBPACK_DEV_SERVER_URL);
    // Load the url of the dev server if in development mode
    await win.loadURL(
      process.env.WEBPACK_DEV_SERVER_URL.replace(/\/$/, "") +
        "/#" +
        path.replace(/^\//, "")
    );
    if (isDevelopment) win.webContents.openDevTools();
  } else {
    // Load the index.html when not in development
    await win.loadURL("app://./index.html#/" + path.replace(/^\//, ""));
  }
  win.webContents.on("new-window", function (e, url) {
    if (url.startsWith("http")) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });
  return win;
}
