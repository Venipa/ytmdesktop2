import { contextBridge, ipcRenderer } from "electron";
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
  quit: () => ipcRenderer.send("app.quit")
});
