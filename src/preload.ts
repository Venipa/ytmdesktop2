import { contextBridge, ipcRenderer } from "electron";
import pkg from "../package.json";
contextBridge.exposeInMainWorld("ipcRenderer", {
  emit: (event, ...data) => ipcRenderer.send(event, ...data),
  on: (channel, func) => ipcRenderer.on(channel, func),
  appVersion: pkg.version,
});

contextBridge.exposeInMainWorld("app", {
  version: pkg.version,
  settings: {
    open: () => ipcRenderer.send("settings.show"),
    close: () => ipcRenderer.send("settings.close"),
  },
  reloadCustomCss: () => ipcRenderer.send("settings.customCssUpdate"),
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
});
