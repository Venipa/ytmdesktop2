import { ipcRenderer } from "electron";
import pkg from "../../package.json";
import translations from "../translations";
console.log(window);
export default {
  ipcRenderer: {
    emit: (event, ...data) => ipcRenderer.send(event, ...data),
    emitTo: (id, event, ...data) => ipcRenderer.sendTo(id, event, ...data),
    on: (channel, func) => ipcRenderer.on(channel, func),
    off: (channel, func) => ipcRenderer.off(channel, func),
    invoke: (channel, ...data) => ipcRenderer.invoke(channel, ...data),
    appVersion: pkg.version,
  },
  process: {
    version: pkg.version,
    environment: process.env.NODE_ENV,
    platform: process.platform,
    isWin11: () => ipcRenderer.invoke("app.isWin11").catch(() => false)
  },
  api: {
    version: pkg.version,
    plugins: [],
    settings: {
      open: (windowName: string) => ipcRenderer.send("subwindow.show", windowName),
      close: (windowName?: string) => ipcRenderer.send("subwindow.close", windowName),
    },
    openWindow: (windowName: string) => ipcRenderer.send("subwindow.show", windowName),
    closeWindow: (windowName?: string) => ipcRenderer.send("subwindow.close", windowName),
    installUpdate: () => ipcRenderer.send("app.installUpdate"),
    checkUpdate: () => ipcRenderer.invoke("app.checkUpdate"),
    settingsProvider: {
      getAll: (defaultValue: any) =>
        ipcRenderer.invoke("settingsProvider.getAll", defaultValue),
      get: (key: string, defaultValue: any) =>
        ipcRenderer.invoke("settingsProvider.get", key, defaultValue),
      set: (key: string, value: any) =>
        new Promise((resolve) => {
          return resolve(ipcRenderer.send("settingsProvider.set", key, value));
        }),
      update: (key, value) =>
        ipcRenderer.invoke("settingsProvider.update", key, value),
      save: () => ipcRenderer.send("settingsProvider.save")
    },
    minimize: () => ipcRenderer.send("app.minimize"),
    maximize: () => ipcRenderer.send("app.maximize"),
    quit: (force) => ipcRenderer.send("app.quit", !!force),
    action: (event: string, ...data: any[]) => ipcRenderer.invoke(`action:${event}`, ...data),
    invoke: (event: string, ...data: any[]) => ipcRenderer.invoke(event, ...data),
    emit: (event: string, ...data: any[]) => ipcRenderer.send(event, ...data),
    emitTo: (id: number, event: string, ...data: any[]) => ipcRenderer.sendTo(id, event, ...data),
    on: (channel: string, func) => ipcRenderer.on(channel, func),
    off: (channel: string, func) => ipcRenderer.off(channel, func),
  },
  translations
};
