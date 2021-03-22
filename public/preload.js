const pkg = require("../package.json");
const { contextBridge, ipcRenderer } = require("electron");
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
  settingsProvider: {
    get: (key, defaultValue) =>
      new Promise((resolve) => {
        return resolve(
          ipcRenderer.sendSync("settingsProvider.get", key, defaultValue)
        );
      }),
    set: (key, value) =>
      new Promise((resolve) => {
        return resolve(ipcRenderer.send("settingsProvider.set", key, value));
      }),
    save: () => ipcRenderer.send("settingsProvider.save"),
  },
});
