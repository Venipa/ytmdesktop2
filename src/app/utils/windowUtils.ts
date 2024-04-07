import logger from "@/utils/Logger";
import { BrowserWindow, screen, shell } from "electron";
import Store from "electron-store";
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
  top?: boolean;
  showTaskBar?: boolean;
  maximizeable?: boolean;
  minimizeable?: boolean;
};
const log = logger.child({ label: "main" });
export function parseScriptPath(p: string) {
  return path.resolve(__dirname, p);
}
export const appIconPath = path.resolve(__static, "favicon.ico");
export async function createAppWindow(appOptions?: Partial<WindowOptions>) {
  // eslint-disable-next-line prefer-const
  let { parent, path, minHeight, minWidth, maxHeight, maxWidth, height, width, top, showTaskBar, minimizeable, maximizeable } = appOptions ?? {};
  if (!path) path = "/";
  // Create the browser window.
  const win = new BrowserWindow({
    width: width ?? 800,
    height: height ?? 600,
    minWidth: minWidth ?? 800,
    minHeight: minHeight ?? 480,
    maxWidth,
    maxHeight,
    minimizable: minimizeable === true,
    maximizable: maximizeable === true,
    backgroundColor: "#000000",
    fullscreenable: !maxWidth && !maxWidth,
    icon: appIconPath,
    frame: false,
    parent,
    modal: parent && top === true,
    skipTaskbar: showTaskBar === false,
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

export async function wrapWindowHandler(win: BrowserWindow, windowName: string, { width: defaultWidth, height: defaultHeight }: { width: number, height: number }) {
  const key = 'window-state';
  const name = `window-state-${windowName}`;
  const store = new Store({ name });
  const defaultSize = {
    width: defaultWidth,
    height: defaultHeight,
  };
  let state: { width: number, height: number, x: number, y: number, maximized?: boolean } = null;
  const restore = () => store.get(key, defaultSize);

  const getCurrentPosition = () => {
    const [x, y] = win.getPosition();
    const [width, height] = win.getSize();
    return {
      x,
      y,
      width,
      height,
      maximized: win.isMaximized()
    };
  };

  const windowWithinBounds = (windowState, bounds) => {
    return (
      windowState.x >= bounds.x &&
      windowState.y >= bounds.y &&
      windowState.x + windowState.width <= bounds.x + bounds.width &&
      windowState.y + windowState.height <= bounds.y + bounds.height
    );
  };

  const resetToDefaults = () => {
    const bounds = screen.getPrimaryDisplay().bounds;
    return Object.assign({}, defaultSize, {
      x: (bounds.width - defaultSize.width) / 2,
      y: (bounds.height - defaultSize.height) / 2,
    });
  };

  const ensureVisibleOnSomeDisplay = windowState => {
    const visible = screen.getAllDisplays().some(display => {
      return windowWithinBounds(windowState, display.bounds);
    });
    if (!visible) {
      // Window is partially or fully not visible now.
      // Reset it to safe defaults.
      return resetToDefaults();
    }
    return windowState;
  };
  const saveState = () => {
    if (!win.isMinimized() && !win.isMaximized()) {
      Object.assign(state, getCurrentPosition());
    }
    store.set(key, state);
  };

  state = ensureVisibleOnSomeDisplay(restore());
  win.on("close", saveState);
  return { state, saveState };
}