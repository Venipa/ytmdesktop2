import translations from "@/translations";
import logger from "@/utils/Logger";
import {
  app,
  BrowserView,
  BrowserWindow,
  BrowserWindowConstructorOptions,
  protocol,
  shell,
} from "electron";
import { debounce } from "lodash-es";
import path from "path";
import { createProtocol } from "vue-cli-plugin-electron-builder/lib";

import { defaultUrl, isDevelopment } from "./utils/devUtils";
import {
  BrowserWindowViews,
  createWindowContext,
  getViewObject,
} from "./utils/mappedWindow";
import { serverMain } from "./utils/serverEvents";
import {
  createEventCollection,
  createPluginCollection,
} from "./utils/serviceCollection";
import { createApiView, createView } from "./utils/view";
import { rootWindowInjectUtils } from "./utils/webContentUtils";
import { createAppWindow, parseScriptPath } from "./utils/windowUtils";
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
  app.userAgentFallback =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:92.0) Gecko/20100101 Firefox/92.0";

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
      title: translations.appName,
      darkTheme: true,
      titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
      maximizable: true,
      webPreferences: {
        nodeIntegration: process.env.ELECTRON_NODE_INTEGRATION === "true",
        contextIsolation: true,
      },
      ...(options || {}),
    });
    win.webContents.session.setUserAgent(app.userAgentFallback);
    win.webContents.session.webRequest.onBeforeSendHeaders(
      {
        urls: ["https://accounts.google.com/*"],
      },
      (details, callback) => {
        const newRequestHeaders = {
          ...(details.requestHeaders || {}),
          ...{
            "User-Agent": app.userAgentFallback,
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
            serverMain.emit("app.loadStart");
          }
        });
      }
    );
    const toolbarView = await createApiView(
      process.platform === "darwin"
        ? "/youtube/toolbar-mac"
        : "/youtube/toolbar",
      (view) => {
        win.addBrowserView(view);
        win.setTopBrowserView(view);
        const [width] = win.getSize();
        view.setBounds({
          height: 40,
          width,
          x: 0,
          y: 0,
        });
        view.setBackgroundColor("transparent");
        view.setAutoResize({ width: true });
        if (isDevelopment) view.webContents.openDevTools({ mode: "detach" });
      }
    );
    serverMain.on("app.loadEnd", () => {
      win.removeBrowserView(loadingView);
      win.setTopBrowserView(toolbarView);
    });
    serverMain.on(
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
        serverMain.emit("settings.customCssUpdate");
        serverMain.emit("settings.customCssWatch");
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
      serverMain.emit("settings.customCssUpdate");
      serverMain.emit("settings.customCssWatch");
    }, 50);
    serviceCollection.exec("AfterInit");
  });

  serverMain.on("app.minimize", (ev) => {
    const window = BrowserWindow.fromWebContents(ev.sender);
    if (window && window.minimizable) window.minimize();
  });
  serverMain.on("app.maximize", (ev) => {
    const window = BrowserWindow.fromWebContents(ev.sender);
    if (window && window.maximizable)
      window.isMaximized() ? window.unmaximize() : window.maximize();
  });
  serverMain.on("app.quit", () => {
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
