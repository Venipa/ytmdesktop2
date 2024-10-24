import translations from "@/translations";
import logger from "@/utils/Logger";
import {
  app,
  BrowserWindow,
  BrowserWindowConstructorOptions,
  IpcMainEvent,
  protocol,
  WebContentsView
} from "electron";
import { debounce } from "lodash-es";
import path from "path";
import { createProtocol } from "vue-cli-plugin-electron-builder/lib";

import { defaultUrl, isDevelopment } from "./utils/devUtils";
import {
  BrowserWindowViews,
  createWindowContext,
  getViewObject
} from "./utils/mappedWindow";
import { serverMain } from "./utils/serverEvents";
import {
  createEventCollection,
  createPluginCollection
} from "./utils/serviceCollection";
import { createApiView, createView, googleLoginPopup } from "./utils/view";
import { callWindowListeners, rootWindowInjectUtils } from "./utils/webContentUtils";
import { appIconPath, wrapWindowHandler } from "./utils/windowUtils";

function parseScriptPath(p: string) {
  return path.resolve(__dirname, p);
}
const log = logger.child({ label: "main" });
export default async function () {
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
  const brickGoogleUA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:92.0) Gecko/20100101 Firefox/92.0";
  app.userAgentFallback =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:92.0) Gecko/20100101 Firefox/92.0";

  /**
   *
   * @param {Electron.BrowserWindowConstructorOptions | undefined} options
   */
  async function createRootWindow(options?: BrowserWindowConstructorOptions) {
    // Create the browser window.
    const winSize = {
      width: 1500,
      height: 800,
    }
    const win = new BrowserWindow({
      ...winSize,
      minWidth: 800,
      minHeight: 480,
      autoHideMenuBar: true,
      icon: appIconPath,
      backgroundColor: "#000000",
      center: true,
      closable: true,
      skipTaskbar: false,
      resizable: true,
      frame: false,
      title: translations.appName,
      darkTheme: true,
      titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
      maximizable: true,
      webPreferences: {
        nodeIntegration: process.env.ELECTRON_NODE_INTEGRATION === "true",
        contextIsolation: true,
        sandbox: false,
        backgroundThrottling: false,
        ...(options?.webPreferences || {}),
      },
      ...(options || {}),
    });
    win.webContents.setUserAgent(app.userAgentFallback);
    win.webContents.session.setUserAgent(app.userAgentFallback);
    win.webContents.session.webRequest.onBeforeSendHeaders(
      {
        urls: ["https://accounts.google.com/*"],
      },
      (details, callback) => {
        details.requestHeaders["User-Agent"] = brickGoogleUA;
        callback(details);
      }
    );
    let unblockedConsentView = false;
    win.webContents.session.webRequest.onBeforeSendHeaders(
      {
        urls: ["https://consent.youtube.com/", "https://consent.youtube.com/*"], // i dont like google
      },
      (details, callback) => {
        if (!unblockedConsentView) {
          serverMain.emit("app.loadEnd");
          unblockedConsentView = true;
        }
        callback(details);
      }
    );
    const loadingView = await createApiView("/youtube/loading", (view) => {
      win.contentView.addChildView(view);
      if (isDevelopment) view.webContents.openDevTools({ mode: "detach" });

      const [width, height] = win.getSize();
      view.setBounds({
        x: 0,
        y: 0,
        width,
        height,
      });
      // view.setAutoResize({ width: true, height: true });
      win.contentView.addChildView(view);
    });
    const youtubeView = await createView(
      parseScriptPath("preload-yt.js"),
      (view) => {
        win.contentView.addChildView(view);
        const [width, height] = win.getSize();
        view.setBounds({
          y: 40,
          x: 0,
          height: height - 40,
          width,
        });
        // view.setAutoResize({ width: true, height: true });
        let lastLocation: string;
        view.webContents.on("did-navigate", (ev, location) => {
          lastLocation = location;
        });
        let isGoogleLoginProcessing = false;
        view.webContents.on("will-navigate", (ev, location) => {
          if (isGoogleLoginProcessing) ev.preventDefault(); // prevent any navigation if google login is processing
          if (location?.match(/^http?s\:\/\/(accounts)?.google.(\w+)/)) {
            ev.preventDefault(); // prevent redirect, use popup
            isGoogleLoginProcessing = true;
            googleLoginPopup(location, win).then((isAuthenticated) => {
              isGoogleLoginProcessing = false
              if (isAuthenticated) {
                youtubeView.webContents.reload();
                return new Promise<void>((resolve) => youtubeView.webContents.once("did-finish-load", () => resolve()))
              };

            }).finally(() => {
              isGoogleLoginProcessing = false;
            })
          }
        })
        view.webContents.on("will-navigate", (ev, location) => {
          if (
            !lastLocation?.match(defaultUrl) &&
            !!location?.match(defaultUrl)
          ) {
            serverMain.emit("app.loadStart");
          }
        });
      },
      {
        contextIsolation: false // true is currently bugged electron@32.2.2
      }
    );
    const toolbarView = await createApiView("/youtube/toolbar", (view) => {
      win.contentView.addChildView(view);
      const [width] = win.getSize();
      view.setBounds({
        height: 40,
        width,
        x: 0,
        y: 0,
      });
      view.setBackgroundColor("transparent");
      if (isDevelopment) view.webContents.openDevTools({ mode: "detach" });
    }, { lockSize: { resize: "width" } });
    serverMain.on("app.loadEnd", () => {
      win.contentView.removeChildView(loadingView);
      win.contentView.addChildView(toolbarView);
    });
    serverMain.on(
      "app.loadStart",
      debounce(() => {
        if (
          !win
            .contentView.children
            ?.find(
              (x) =>
                loadingView.webContents &&
                x === loadingView
            )
        )
          win.contentView.addChildView(loadingView);
      }, 100)
    );
    const { state } = await wrapWindowHandler(win, "root", { ...winSize });
    if (state.maximized) win.maximize();
    else win.setBounds({ ...state });
    callWindowListeners(win, "will-resize", state);
    serverMain.emit("app.loadStart");
    await youtubeView.webContents.loadURL(defaultUrl).then(() => {
      if (isDevelopment)
        youtubeView.webContents.openDevTools({ mode: "detach" });
      if (process.platform === "darwin") {
        const bounds = win.getBounds();
        win.setBounds({
          width: bounds.width + 1,
        });
        win.setBounds({
          width: bounds.width - 1,
        });
      }
    });

    try {
      if (serviceCollection)
        serviceCollection.providers.forEach((p) =>
          p.__registerWindows(mainWindow)
        );
    } catch { }
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
    const __data = {
      main: win,
      views: {
        youtubeView,
        toolbarView,
      },
    };
    return createWindowContext<typeof __data.views>(__data);
  }

  // Quit when all windows are closed.
  app.on("window-all-closed", () => {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== "darwin") {
      serverMain.emit("app.quit", null, true);
    }
  });

  let mainWindow: BrowserWindowViews<{
    youtubeView: WebContentsView;
    toolbarView: WebContentsView;
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
    mainWindow.views.youtubeView.webContents.once("did-finish-load", () => {
      serviceCollection.exec("AfterInit");
    })
    mainWindow.main.blur();
    setTimeout(() => {
      mainWindow.main.focus(); // fix hibernation/standby expired window cache
    }, 50);
  });

  serverMain.on("app.minimize", (ev) => {
    const window = BrowserWindow.fromWebContents(ev.sender);
    if (window && window.isMinimizable()) window.minimize();
  });
  serverMain.on("app.maximize", (ev) => {
    const window = BrowserWindow.fromWebContents(ev.sender);
    if (window && window.isMaximizable())
      window.isMaximized() ? window.unmaximize() : window.maximize();
  });
  let forcedQuit = false;
  serverMain.on("app.quit", (ev: IpcMainEvent, forceQuit: boolean) => {
    forcedQuit = !!forceQuit;
    app.quit();
  });
  app.on("before-quit", (ev) => {
    // dont allow prevent of quit if update queued
    if (
      forcedQuit ||
      serviceCollection.getProvider("update")
        .updateQueuedForInstall
    )
      return;
    const settings =
      serviceCollection.getProvider("settings");
    if (settings.get("app.minimizeTrayOverride")) {
      serverMain.emit("app.trayState", null, "hidden");
      ev.preventDefault(); // prevent quit - minimize to tray
    } else {
      serviceCollection.getProvider("settings")?.saveToDrive();
    }
  });
  serverMain.on("app.restore", () => {
    if (!mainWindow.main.isVisible()) {
      serverMain.emit("app.trayState", null, "visible");
    }
  });
  serverMain.on("app.trayState", (ev: IpcMainEvent, state: string) => {
    if (state === "visible" && !mainWindow.main.isVisible()) {
      mainWindow.main.show();
      mainWindow.main.setSkipTaskbar(false);
    } else if (state === "hidden" && mainWindow.main.isVisible()) {
      mainWindow.main.hide();
      mainWindow.main.setSkipTaskbar(true);
    }
  });

  // Exit cleanly on request from parent process in development mode.
  if (isDevelopment) {
    if (process.platform === "win32") {
      process.on("message", (data) => {
        if (data === "graceful-exit") {
          serviceCollection
            .exec("OnDestroy")
            .then(() => serverMain.emit("app.quit", true));
        }
      });
    } else {
      process.on("SIGTERM", () => {
        serviceCollection
          .exec("OnDestroy")
          .then(() => serverMain.emit("app.quit", true));
      });
    }
  }
}
