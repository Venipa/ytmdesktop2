import {
  app,
  protocol,
  BrowserWindow,
  ipcRenderer,
  ipcMain,
  shell,
  BrowserWindowConstructorOptions,
  contextBridge,
  BrowserView,
} from "electron";
import { createProtocol } from "vue-cli-plugin-electron-builder/lib";
import installExtension, { VUEJS3_DEVTOOLS } from "electron-devtools-installer";
import path from "path";
import { BaseProvider } from "./plugins/_baseProvider";
import { rootWindowInjectUtils } from "./utils/webContentUtils";
import { defaultUrl, isDevelopment } from "./utils/devUtils";
import { BrowserWindowViews, getViewObject } from "./utils/mappedWindow";
import { debounce } from "lodash-es";
import logger from "@/utils/Logger";

function parseScriptPath(p: string) {
  return path.resolve(__dirname, p);
}
const log = logger.child({ label: "main" });
export default async function() {
  const serviceCollection = (() => {
    const pluginContext = require.context("./plugins", false, /plugin.ts$/i);
    const providers = pluginContext
      .keys()
      .map(pluginContext)
      .map((m: any) => {
        return m.default;
      })
      .map((provider: any) => new provider(app));
    providers.forEach((p: BaseProvider) =>
      p._registerProviders(
        providers.filter((_p: BaseProvider) => _p.getName() !== p.getName())
      )
    );
    return {
      providers,
      getProviderNames: () => providers.map((x: BaseProvider) => x.getName()),
      exec: async (
        event: "OnInit" | "OnDestroy" | "AfterInit" | "BeforeStart"
      ) => {
        return await Promise.all(
          providers
            .filter((x) => typeof x[event] === "function")
            .map((x) => Promise.resolve(x[event](app)))
        );
      },
      getProvider: <T>(name: string): T =>
        providers.find((x) => x.getName() === name),
    };
  })();
  log.debug(
    `Loaded Providers: ${serviceCollection.getProviderNames().join(", ")}`
  );

  try {
    await serviceCollection.exec("BeforeStart");
  } catch (ex) {
    log.error(ex); // before start can be ignored, experimental
  }
  /**
   *
   * @param {Electron.BrowserWindowConstructorOptions | undefined} options
   */
  async function createRootWindow(options?: BrowserWindowConstructorOptions) {
    // Create the browser window.
    const win = new BrowserWindow({
      width: 1500,
      height: 800,
      minWidth: 600,
      minHeight: 480,
      autoHideMenuBar: true,
      backgroundColor: "#000000",
      center: true,
      closable: true,
      skipTaskbar: false,
      resizable: true,
      frame: false,
      darkTheme: true,
      titleBarStyle: "hidden",
      maximizable: true,
      webPreferences: {
        nodeIntegration: process.env.ELECTRON_NODE_INTEGRATION === "true",
        contextIsolation: true,
      },
      ...(options || {}),
    });
    win.webContents.session.webRequest.onBeforeSendHeaders(
      {
        urls: ["https://accounts.google.com/*"],
      },
      (details, callback) => {
        const newRequestHeaders = {
          ...(details.requestHeaders || {}),
          ...{
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:73.0) Gecko/20100101 Firefox/73.0",
          },
        };
        callback({ requestHeaders: newRequestHeaders });
      }
    );
    const youtubeView = new BrowserView({
      webPreferences: {
        nodeIntegration: process.env.ELECTRON_NODE_INTEGRATION === "true",
        contextIsolation: true,
        preload: parseScriptPath("preload.js"),
      },
    });
    const toolbarView = new BrowserView({
      webPreferences: {
        nodeIntegration: process.env.ELECTRON_NODE_INTEGRATION === "true",
        contextIsolation: true,
        sandbox: true,
        nativeWindowOpen: true,
        preload: parseScriptPath("preload.js"),
      },
    });
    const toolbarUrl = (process.env.WEBPACK_DEV_SERVER_URL
      ? process.env.WEBPACK_DEV_SERVER_URL
      : "app://./index.html/"
    ).concat("#/youtube/toolbar");
    win.addBrowserView(youtubeView);
    win.addBrowserView(toolbarView);
    const windowSize = win.getSize();
    youtubeView.setBounds({
      y: 40,
      x: 0,
      height: windowSize[1] - 40,
      width: windowSize[0],
    });
    toolbarView.setBounds({
      height: 40,
      y: 0,
      x: 0,
      width: windowSize[0],
    });
    toolbarView.setAutoResize({ width: true });
    youtubeView.setAutoResize({ width: true, height: true });
    await toolbarView.webContents.loadURL(toolbarUrl);
    await youtubeView.webContents.loadURL(defaultUrl);

    if (isDevelopment)
      youtubeView.webContents.openDevTools({ mode: "detach" }),
        toolbarView.webContents.openDevTools({ mode: "detach" });

    try {
      if (serviceCollection)
        serviceCollection.providers.forEach((p) =>
          p._registerWindows(mainWindow)
        );
    } catch {}
    let fromMaximized = false;
    win.on("maximize", () => {
      fromMaximized = true;
      if (process.platform === "win32")
        toolbarView.setBounds({
          ...toolbarView.getBounds(),
          width: win.getSize()[0] - 20,
        });
    });
    win.on(
      "resize",
      debounce(() => {
        if (fromMaximized && !win.isMaximized())
          toolbarView.setBounds({
            ...toolbarView.getBounds(),
            width: win.getSize()[0],
          });
      }, 50)
    );
    youtubeView.webContents.on("page-title-updated", (ev, title) =>
      youtubeView.webContents.emit("window-title-updated", title)
    );
    return {
      main: win,
      views: {
        youtubeView,
        toolbarView,
      },
    };
  }
  async function createAppWindow() {
    // Create the browser window.
    const win = new BrowserWindow({
      width: 800,
      height: 600,
      minWidth: 600,
      minHeight: 480,
      minimizable: false,
      backgroundColor: "#000000",
      frame: false,
      parent: mainWindow.main,
      darkTheme: true,
      webPreferences: {
        // Use pluginOptions.nodeIntegration, leave this alone
        // See nklayman.github.io/vue-cli-plugin-electron-builder/guide/security.html#node-integration for more info
        nodeIntegration: process.env.ELECTRON_NODE_INTEGRATION === "true",
        contextIsolation: true,
        preload: parseScriptPath("preload.js"),
      },
    });
    if (process.env.WEBPACK_DEV_SERVER_URL) {
      log.debug("dev url:", process.env.WEBPACK_DEV_SERVER_URL);
      // Load the url of the dev server if in development mode
      await win.loadURL(process.env.WEBPACK_DEV_SERVER_URL);
      if (isDevelopment) win.webContents.openDevTools();
    } else {
      // Load the index.html when not in development
      await win.loadURL("app://./index.html");
    }
    win.webContents.on("new-window", function(e, url) {
      if (url.startsWith("http")) {
        e.preventDefault();
        shell.openExternal(url);
      }
    });
    return win;
  }

  // Quit when all windows are closed.
  app.on("window-all-closed", () => {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  let mainWindow: BrowserWindowViews<{
    youtubeView: BrowserView;
    toolbarView: BrowserView;
  }>;
  app.on("activate", async () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = await createRootWindow();
      rootWindowInjectUtils(
        mainWindow.views.youtubeView.webContents,
        getViewObject(mainWindow.views)
      );

      if (serviceCollection)
        serviceCollection.providers.forEach((p) =>
          p._registerWindows(mainWindow)
        );
      setTimeout(() => {
        ipcMain.emit("settings.customCssUpdate");
        ipcMain.emit("settings.customCssWatch");
      }, 50);
    }
  });
  app.on("ready", async () => {
    if (isDevelopment && !process.env.IS_TEST) {
      // Install Vue Devtools
      // try {
      //   await installExtension(VUEJS3_DEVTOOLS);
      // } catch (e) {
      //   log.error("Vue Devtools failed to install:", e.message);
      // }
    } else {
      createProtocol("app");
    }
    await serviceCollection.exec("OnInit");
    mainWindow = await createRootWindow();
    rootWindowInjectUtils(
      mainWindow.views.youtubeView.webContents,
      getViewObject(mainWindow.views)
    );
    serviceCollection.providers.forEach((p) => p._registerWindows(mainWindow));
    setTimeout(() => {
      ipcMain.emit("settings.customCssUpdate");
      ipcMain.emit("settings.customCssWatch");
    }, 50);
    serviceCollection.exec("AfterInit");
  });

  let settingsWindow: BrowserWindow;
  ipcMain.on("settings.show", async () => {
    try {
      if (!settingsWindow || settingsWindow.isDestroyed()) {
        settingsWindow = await createAppWindow();
      } else {
        settingsWindow.show();
      }
      mainWindow.views.settingsWindow = settingsWindow.getBrowserView();
    } catch (err) {
      log.error(err);
    }
  });
  ipcMain.on("settings.close", async () => {
    if (settingsWindow) {
      settingsWindow.hide();
      if (isDevelopment) settingsWindow.webContents.closeDevTools();
      settingsWindow.close();
      
      if (mainWindow.views.settingsWindow) mainWindow.views.settingsWindow = null;
    }
  });
  ipcMain.on("app.minimize", (ev) => {
    const window = BrowserWindow.fromWebContents(ev.sender);
    if (window && window.minimizable) window.minimize();
  });
  ipcMain.on("app.maximize", (ev) => {
    const window = BrowserWindow.fromWebContents(ev.sender);
    if (window && window.maximizable)
      window.isMaximized() ? window.unmaximize() : window.maximize();
  });
  ipcMain.on("app.quit", () => {
    app.quit();
  });

  // Exit cleanly on request from parent process in development mode.
  if (isDevelopment) {
    ipcMain
      .eventNames()
      .filter((x) => typeof x === "string")
      .forEach((event: any) =>
        ipcMain.on(event as string, (ev, ...args) =>
          logger.child({ label: `event:${event}` }).debug(event, ...args)
        )
      );
    if (process.platform === "win32") {
      process.on("message", (data) => {
        if (data === "graceful-exit") {
          serviceCollection.exec("OnDestroy").then(app.quit);
        }
      });
    } else {
      process.on("SIGTERM", () => {
        serviceCollection.exec("OnDestroy").then(app.quit);
      });
    }
  }
}
