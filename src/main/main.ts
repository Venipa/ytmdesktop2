import logger from "@shared/utils/Logger";
import translations from "@translations/index";
import {
  app,
  BrowserWindow,
  BrowserWindowConstructorOptions,
  IpcMainEvent,
  protocol,
  WebContentsView,
} from "electron";
import { debounce } from "lodash-es";

import { waitMs } from "@shared/utils/promises";
import { join } from "path";
import appIconPath from "~/build/favicon.ico?asset";
import { defaultUrl, isDevelopment, isProduction } from "./utils/devUtils";
import { initializeCustomElectronEnvironment } from "./utils/electron";
import { BrowserWindowViews, createWindowContext } from "./utils/mappedWindow";
import { serverMain } from "./utils/serverEvents";
import { createEventCollection, createPluginCollection } from "./utils/serviceCollection";
import { createApiView, createView, googleLoginPopup } from "./utils/view";
import {
  callWindowListeners,
  pushWindowStates,
  syncMainWindowStates,
} from "./utils/webContentUtils";
import { wrapWindowHandler } from "./utils/windowUtils";
initializeCustomElectronEnvironment();
const log = logger.child("main");
const runApp = async function () {
  const serviceCollection = await createPluginCollection(app),
    eventCollection = await createEventCollection(app, serviceCollection.providers);
  log.debug(`Loaded Providers: ${serviceCollection.getProviderNames().join(", ")}`);
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
    };
    const win = new BrowserWindow({
      ...winSize,
      minWidth: 800,
      minHeight: 480,
      autoHideMenuBar: true,
      icon: appIconPath,
      backgroundColor: "#030404",
      center: true,
      closable: true,
      skipTaskbar: false,
      resizable: true,
      frame: false,
      title: translations.appName,
      darkTheme: true,
      titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
      maximizable: true,
      show: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: true,
        sandbox: false,
        webSecurity: isProduction,
        allowRunningInsecureContent: !isProduction,
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
      },
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
      },
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
      join(__dirname, "../preload/youtube.js"),
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
            googleLoginPopup(location, win)
              .then((isAuthenticated) => {
                isGoogleLoginProcessing = false;
                if (isAuthenticated) {
                  youtubeView.webContents.reload();
                  return new Promise<void>((resolve) =>
                    youtubeView.webContents.once("did-finish-load", () => resolve()),
                  );
                }
                return Promise.resolve(null);
              })
              .finally(() => {
                isGoogleLoginProcessing = false;
              });
          }
        });
        view.webContents.on("will-navigate", (ev, location) => {
          if (!lastLocation?.match(defaultUrl) && !!location?.match(defaultUrl)) {
            serverMain.emit("app.loadStart");
          } else pushWindowStates(view.webContents.id);
        });
      },
      {
        sandbox: false,
        contextIsolation: false, // true is currently bugged electron@^30
      },
    );
    const toolbarView = await createApiView(
      "/youtube/toolbar",
      (view) => {
        win.contentView.addChildView(view);
        win.contentView.addChildView(loadingView);
        const [width, height] = win.getSize();
        view.setBounds({
          height: 40,
          width,
          x: 0,
          y: 0,
        });
        if (isDevelopment) view.webContents.openDevTools({ mode: "detach" });
      },
      { lockSize: { resize: "width" }, transparent: true },
    );
    serverMain.on("app.loadEnd", () => {
      win.contentView.removeChildView(loadingView);
      win.contentView.addChildView(toolbarView);
    });
    serverMain.on(
      "app.loadStart",
      debounce(() => {
        if (!win.contentView.children?.find((x) => loadingView.webContents && x === loadingView))
          win.contentView.addChildView(loadingView);
      }, 100),
    );
    const { state } = await wrapWindowHandler(win, "root", { ...winSize });
    if (state?.maximized) win.maximize();
    else win.setBounds({ ...state });
    callWindowListeners(win, "will-resize", state);
    serverMain.emit("app.loadStart");
    await youtubeView.webContents.loadURL(defaultUrl).then(() => {
      if (isDevelopment) youtubeView.webContents.openDevTools({ mode: "detach" });
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
      if (serviceCollection) {
        const preContext = createWindowContext({ main: win, views: { youtubeView } });
        serviceCollection.providers.forEach((p) => p.__registerWindows(preContext));
      }
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
        const [winWidth, winHeight] = win.getSize(),
          youtubeBounds = youtubeView.getBounds(),
          toolbarBounds = toolbarView.getBounds();
        toolbarView.setBounds({
          ...toolbarBounds,
          width: winWidth,
        });
        youtubeView.setBounds({
          ...youtubeBounds,
          width: winWidth,
          height: winHeight - toolbarBounds.height,
        });
      }, 100),
    );
    youtubeView.webContents.on("page-title-updated", (ev, title) =>
      youtubeView.webContents.emit("window-title-updated", title),
    );
    const __data = {
      main: win,
      views: {
        youtubeView,
        toolbarView,
      },
    };
    const _context = createWindowContext<typeof __data.views>(__data);
    syncMainWindowStates(_context);
    return _context;
  }
  const reactivate = async () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = await createRootWindow();
      await waitMs(); // next tick
      mainWindow.main.show();

      if (serviceCollection) {
        serviceCollection.providers.forEach((p) => p.__registerWindows(mainWindow));
        serviceCollection.exec("AfterInit");
      }
    }
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
  app.on("activate", reactivate);
  app.on("ready", async () => {
    await serviceCollection.exec("OnInit");
    await waitMs(); // next tick
    mainWindow = await createRootWindow();
    await waitMs(); // next tick
    mainWindow.main.show();
    serviceCollection.providers.forEach((p) => p.__registerWindows(mainWindow));
    serviceCollection.exec("AfterInit");
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
  serverMain.on("app.goback", () => {
    const { youtubeView } = mainWindow.views ?? {};
    if (
      !youtubeView ||
      youtubeView.webContents.isDestroyed() ||
      !youtubeView.webContents.navigationHistory.canGoBack()
    )
      return;
    youtubeView.webContents.navigationHistory.goBack();
  });
  let forcedQuit = false;
  serverMain.on("app.quit", (ev: IpcMainEvent, forceQuit: boolean) => {
    forcedQuit = !!forceQuit;
    app.quit();
  });
  app.on("before-quit", (ev) => {
    // dont allow prevent of quit if update queued
    if (forcedQuit || serviceCollection.getProvider("update").updateQueuedForInstall) return;
    const settings = serviceCollection.getProvider("settings");
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
          serviceCollection.exec("OnDestroy").then(() => serverMain.emit("app.quit", true));
        }
      });
    } else {
      process.on("SIGTERM", () => {
        serviceCollection.exec("OnDestroy").then(() => serverMain.emit("app.quit", true));
      });
    }
  }
};

runApp();
