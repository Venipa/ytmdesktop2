"use strict";

import {
  app,
  protocol,
  BrowserWindow,
  ipcRenderer,
  ipcMain,
} from "electron";
import { createProtocol } from "vue-cli-plugin-electron-builder/lib";
import installExtension, { VUEJS_DEVTOOLS } from "electron-devtools-installer";
import path from 'path';
import youtubeInjectScript from "!raw-loader!./youtube-inject.js";
const isDevelopment = process.env.NODE_ENV !== "production";
const defaultUrl = "https://music.youtube.com";
// Scheme must be registered before the app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: "ytm", privileges: { secure: true, standard: true } },
]);


/**
 *
 * @param {BrowserWindow} win
 */
async function rootWindowInjectUtils(win) {
  console.log(youtubeInjectScript);
  await win.webContents.executeJavaScript(`${youtubeInjectScript}`);
}
/**
 *
 * @param {Electron.BrowserWindowConstructorOptions | undefined} options
 */
async function createRootWindow(options) {
  // Create the browser window.
  const win = new BrowserWindow({
    width: 1500,
    height: 800,
    autoHideMenuBar: true,
    backgroundColor: "#232323",
    center: true,
    closable: true,
    skipTaskbar: false,
    resize: true,
    maximizable: true,
    webPreferences: {
      nodeIntegration: process.env.ELECTRON_NODE_INTEGRATION,
      webviewTag: true,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.resolve(__static, 'preload.js'),
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
      nodeIntegration: process.env.ELECTRON_NODE_INTEGRATION,
      webviewTag: true,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.resolve(__static, 'preload.js'),
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

(function() {
  /**
   * @type {BrowserWindow | null} mainWindow
   */
  let mainWindow;
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
    mainWindow = await createRootWindow();
    mainWindow.webContents.openDevTools();
    rootWindowInjectUtils(mainWindow);
    ipcMain.emit("settings.show");
  });

  /**
   * @type {BrowserWindow | null} settingsWindow
   */
  let settingsWindow;
  ipcMain.on("settings.show", async () => {
    try {
      if (!settingsWindow) {
        settingsWindow = await createAppWindow({
          parent: mainWindow,
        });
      } else {
        settingsWindow.show();
      }
    } catch (err) {
      console.error(err);
    }
  });
  ipcMain.on('settings.close', async () => settingsWindow.close());
})();

// Exit cleanly on request from parent process in development mode.
if (isDevelopment) {
  if (process.platform === "win32") {
    process.on("message", (data) => {
      if (data === "graceful-exit") {
        app.quit();
      }
    });
  } else {
    process.on("SIGTERM", () => {
      app.quit();
    });
  }
}
