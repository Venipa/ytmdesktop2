import { contextBridge, ipcRenderer,  } from "electron";
import pkg from "../package.json";
contextBridge.exposeInMainWorld("ipcRenderer", {
  emit: (event, ...data) => {
    console.log('ytd2-emit |', event, ...data);
    ipcRenderer.send(event, ...data);
  },
  emitTo: (id, event, ...data) => ipcRenderer.sendTo(id, event, ...data),
  on: (channel, func) => ipcRenderer.on(channel, func),
  appVersion: pkg.version,
});
contextBridge.exposeInMainWorld("process", {
  version: pkg.version,
  environment: process.env.NODE_ENV,
  discord: {
    implemented: process.env.VUE_APP_DISCORD_CLIENT_ID ? process.env.VUE_APP_DISCORD_CLIENT_ID.slice(0, 5) + "*".repeat(process.env.VUE_APP_DISCORD_CLIENT_ID.length - 5) : false
  }
})
contextBridge.exposeInMainWorld("api", {
  version: pkg.version,
  settings: {
    open: () => ipcRenderer.send("settings.show"),
    close: () => ipcRenderer.send("settings.close"),
  },
  installUpdate: () => ipcRenderer.send("app.installUpdate"),
  checkUpdate: () => ipcRenderer.send("app.checkUpdate"),
  reloadCustomCss: () => ipcRenderer.send("settings.customCssUpdate"),
  watchCustomCss: (enabled) =>
    ipcRenderer.send("settings.customCssWatch", enabled),
  settingsProvider: {
    get: (key, defaultValue) =>
      ipcRenderer.invoke("settingsProvider.get", key, defaultValue),
    set: (key, value) =>
      new Promise((resolve) => {
        return resolve(ipcRenderer.send("settingsProvider.set", key, value));
      }),
    update: (key, value) =>
      ipcRenderer.invoke("settingsProvider.update", key, value),
    save: () => ipcRenderer.send("settingsProvider.save"),
  },
  minimize: () => ipcRenderer.send('app.minimize'),
  maximize: () => ipcRenderer.send('app.maximize'),
  quit: () => ipcRenderer.send("app.quit")
});
