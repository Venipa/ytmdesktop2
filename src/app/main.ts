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
import { BaseProvider } from "./utils/baseProvider";
import { rootWindowInjectUtils } from "./utils/webContentUtils";
import { defaultUrl, isDevelopment } from "./utils/devUtils";
import { BrowserWindowViews, getViewObject } from "./utils/mappedWindow";
import { debounce } from "lodash-es";
import logger from "@/utils/Logger";
import {
  createEventCollection,
  createPluginCollection,
} from "./utils/serviceCollection";
import { createApiView, createView } from "./utils/view";

function parseScriptPath(p: string) {
  return path.resolve(__dirname, p);
}
const log = logger.child({ label: "main" });
export default async function() {
  const serviceCollection = await createPluginCollection(app),
    eventCollection = await createEventCollection(
      app,
      serviceCollection.providers
    );
  log.debug(
    `Loaded Providers: ${serviceCollection.getProviderNames().join(", ")}`
  );
  log.debug(`Loaded Events: ${eventCollection.getProviderNames().join(", ")}`);

  try {
    await serviceCollection.exec("BeforeStart");
    await eventCollection.prepare();
  } catch (ex) {
    log.error(ex); // before start can be ignored, experimental
  }

  protocol.registerSchemesAsPrivileged([
    { scheme: "app", privileges: { secure: true, standard: true } },
  ]);
  /**
   *
   * @param {Electron.BrowserWindowConstructorOptions | undefined} options
   */
  async function createRootWindow(options?: BrowserWindowConstructorOptions) {
    // Create the browser window.
    const win = new BrowserWindow({
      width: 1500,
      height: 800,
      minWidth: 800,
      minHeight: 480,
      autoHideMenuBar: true,
      icon: path.resolve(__static, "favicon.ico"),
      backgroundColor: "#000000",
      center: true,
      closable: true,
      skipTaskbar: false,
      resizable: true,
      frame: false,
      title: "Youtube Music for Desktop",
      darkTheme: true,
      titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
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
    const loadingView = await createApiView("/youtube/loading", (view) => {
      win.addBrowserView(view);
      if (isDevelopment) view.webContents.openDevTools({ mode: "detach" });

      const [width, height] = win.getSize();
      view.setBounds({
        x: 0,
        y: 0,
        width,
        height,
      });
      view.setAutoResize({ width: true, height: true });
      win.setTopBrowserView(view);
    });
    const youtubeView = await createView(
      parseScriptPath("preload-yt.js"),
      (view) => {
        win.addBrowserView(view);
        const [width, height] = win.getSize();
        view.setBounds({
          y: 40,
          x: 0,
          height: height - 40,
          width,
        });
        view.setAutoResize({ width: true, height: true });
        let lastLocation: string;
        view.webContents.on("did-navigate", (ev, location) => {
          lastLocation = location;
        });
        view.webContents.on("will-navigate", (ev, location) => {
          if (
            !lastLocation?.match(defaultUrl) &&
            !!location?.match(defaultUrl)
          ) {
            ipcMain.emit("app.loadStart");
          }
        });
      }
    );
    const toolbarView = await createApiView("/youtube/toolbar", (view) => {
      win.addBrowserView(view);
      const [width, height] = win.getSize();
      view.setBounds({
        height: 40,
        y: 0,
        x: 0,
        width,
      });
      view.setAutoResize({ width: true });
      if (isDevelopment) view.webContents.openDevTools({ mode: "detach" });
    });
    ipcMain.on("app.loadEnd", () => win.removeBrowserView(loadingView));
    ipcMain.on(
      "app.loadStart",
      debounce(() => {
        if (
          !win
            .getBrowserViews()
            ?.find(
              (x) =>
                loadingView.webContents &&
                x.webContents.id === loadingView.webContents.id
            )
        )
          win.addBrowserView(loadingView);
        win.setTopBrowserView(loadingView);
      }, 100)
    );
    ipcMain.emit("app.loadStart");
    await youtubeView.webContents.loadURL(defaultUrl).then(() => {
      if (isDevelopment)
        youtubeView.webContents.openDevTools({ mode: "detach" });
    });

    try {
      if (serviceCollection)
        serviceCollection.providers.forEach((p) =>
          p.__registerWindows(mainWindow)
        );
    } catch {}
    let fromMaximized = false;
    win.on("maximize", () => {
      fromMaximized = true;
      const [winWidth, winHeight] = win.getSize(),
        youtubeBounds = youtubeView.getBounds(),
        toolbarBounds = toolbarView.getBounds();

      toolbarView.setBounds({
        ...toolbarView.getBounds(),
        width: winWidth - 16,
      });
      youtubeView.setBounds({
        ...youtubeBounds,
        height: winHeight - toolbarBounds.height - 16,
      });
    });
    win.on(
      "resize",
      debounce(() => {
        if (fromMaximized && !win.isMaximized()) {
          const [winWidth, winHeight] = win.getSize(),
            youtubeBounds = youtubeView.getBounds(),
            toolbarBounds = toolbarView.getBounds();
          toolbarView.setBounds({
            ...toolbarBounds,
            width: winWidth,
          });
          youtubeView.setBounds({
            ...youtubeBounds,
            height: winHeight - toolbarBounds.height,
          });
          fromMaximized = false;
        }
      }, 100)
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
      minWidth: 800,
      minHeight: 480,
      minimizable: false,
      backgroundColor: "#000000",
      frame: false,
      parent: mainWindow.main,
      modal: true,
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
          p.__registerWindows(mainWindow)
        );
      setTimeout(() => {
        ipcMain.emit("settings.customCssUpdate");
        ipcMain.emit("settings.customCssWatch");
      }, 50);
    }
  });
  app.on("ready", async () => {
    if (isDevelopment && !process.env.IS_TEST) {
    } else {
      createProtocol("app");
    }
    await serviceCollection.exec("OnInit");
    mainWindow = await createRootWindow();
    rootWindowInjectUtils(
      mainWindow.views.youtubeView.webContents,
      getViewObject(mainWindow.views)
    );
    serviceCollection.providers.forEach((p) => p.__registerWindows(mainWindow));
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

      if (mainWindow.views.settingsWindow)
        mainWindow.views.settingsWindow = null;
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
