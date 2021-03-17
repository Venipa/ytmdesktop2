import {
  app,
  protocol,
  BrowserWindow,
  ipcRenderer,
  ipcMain,
  shell,
  BrowserWindowConstructorOptions,
  contextBridge,
} from "electron";
import { createProtocol } from "vue-cli-plugin-electron-builder/lib";
import installExtension, { VUEJS_DEVTOOLS } from "electron-devtools-installer";
import path from "path";
// @ts-ignore
import youtubeInjectScript from "!raw-loader!../youtube-inject.js";
import { BaseProvider } from "./plugins/_baseProvider";
import SettingsProvider from "./plugins/settingsProvider.plugin";
const isDevelopment = process.env.NODE_ENV !== "production";
const defaultUrl = "https://music.youtube.com";

export default function() {
  const serviceCollection = (() => {
    const pluginContext = require.context("./plugins", false, /plugin.ts$/i);
    const providers = pluginContext
      .keys()
      .map(pluginContext)
      .map((m: any) => {
        return m.default;
      })
      .map((provider: any) => new provider(app));
    return {
      providers,
      getProviderNames: () => providers.map((x: BaseProvider) => x.getName()),
      exec: async (event: "OnInit" | "OnDestroy" | "AfterInit") => {
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
  console.log(
    `Loaded Providers: ${serviceCollection.getProviderNames().join(", ")}`
  );
  // Scheme must be registered before the app is ready
  protocol.registerSchemesAsPrivileged([
    { scheme: "ytm", privileges: { secure: true, standard: true } },
  ]);

  /**
   *
   * @param {BrowserWindow} win
   */
  async function rootWindowInjectUtils(win: BrowserWindow) {
    // Inject css
    const css = await import(
      // @ts-ignore
      "!raw-loader!sass-loader!../assets/youtube-inject.scss"
    );
    if (!css) console.error(css.default);
    console.log(
      "youtube-inject.js",
      await win.webContents.executeJavaScript(
        `${youtubeInjectScript}
    initializeYoutubeDesktop({
      customCss: \`${css.default}\`
    })
    `
      ),
      css.default
    );
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
      autoHideMenuBar: true,
      backgroundColor: "#232323",
      center: true,
      closable: true,
      skipTaskbar: false,
      resizable: true,
      maximizable: true,
      webPreferences: {
        nodeIntegration: process.env.ELECTRON_NODE_INTEGRATION === "true",
        webviewTag: true,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: path.resolve(__static, "preload.js"),
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
    await win.loadURL(defaultUrl);
    return win;
  }
  async function createAppWindow() {
    // Create the browser window.
    const win = new BrowserWindow({
      width: 800,
      height: 600,
      backgroundColor: "#232323",
      frame: false,
      webPreferences: {
        // Use pluginOptions.nodeIntegration, leave this alone
        // See nklayman.github.io/vue-cli-plugin-electron-builder/guide/security.html#node-integration for more info
        nodeIntegration: process.env.ELECTRON_NODE_INTEGRATION === "true",
        webviewTag: true,
        contextIsolation: true,
        enableRemoteModule: true,
        preload: path.resolve(__static, "preload.js"),
      },
    });

    if (process.env.WEBPACK_DEV_SERVER_URL) {
      console.log("dev url:", process.env.WEBPACK_DEV_SERVER_URL);
      // Load the url of the dev server if in development mode
      await win.loadURL(process.env.WEBPACK_DEV_SERVER_URL);
      if (!process.env.IS_TEST) win.webContents.openDevTools();
    } else {
      createProtocol("ytm");
      // Load the index.html when not in development
      await win.loadURL("ytm://./index.html");
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

  let mainWindow: BrowserWindow;
  app.on("activate", async () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = await createRootWindow();
      rootWindowInjectUtils(mainWindow);
    }
  });
  app.on("ready", async () => {
    if (isDevelopment && !process.env.IS_TEST) {
      // Install Vue Devtools
      try {
        await installExtension(VUEJS_DEVTOOLS);
      } catch (e) {
        console.error("Vue Devtools failed to install:", e.toString());
      }
    }
    await serviceCollection.exec("OnInit");
    mainWindow = await createRootWindow();
    await serviceCollection.exec("AfterInit");
    mainWindow.webContents.openDevTools();
    rootWindowInjectUtils(mainWindow);

    const settingsProvider = serviceCollection.getProvider<SettingsProvider>(
      "Settings Provider"
    );
    ipcMain.on("settingsProvider.get", (ev, ...[key, value]) => {
      ev.returnValue = settingsProvider.get(key) || value;
    });
    ipcMain.on("settingsProvider.set", (ev, ...[key, value]) => {
      settingsProvider.set(key, value);
    });

    ipcMain.emit("settings.show");
  });

  let settingsWindow: BrowserWindow;
  ipcMain.on("settings.show", async () => {
    try {
      if (!settingsWindow) {
        settingsWindow = await createAppWindow();
      } else {
        settingsWindow.show();
      }
    } catch (err) {
      console.error(err);
    }
  });
  ipcMain.on(
    "settings.close",
    async () => settingsWindow && settingsWindow.hide()
  );

  // Exit cleanly on request from parent process in development mode.
  if (isDevelopment) {
    ipcMain
      .eventNames()
      .filter((x) => typeof x === "string")
      .forEach((event: any) =>
        ipcMain.on(event as string, (ev, ...args) =>
          console.log(event, ...args)
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
