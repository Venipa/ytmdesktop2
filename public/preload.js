const { contextBridge, ipcRenderer } = require("electron");
const appVersion = '0.1.0';
contextBridge.exposeInMainWorld("ipcRenderer", {
  emit: (event, ...data) => ipcRenderer.send(event, ...data),
  on: (channel, func) => ipcRenderer.on(channel, func),
  appVersion
});

contextBridge.exposeInMainWorld("app", {
  version: appVersion,
  settings: {
    open: () => ipcRenderer.send("settings.show"),
    close: () => ipcRenderer.send("settings.close"),
  },
  reloadCustomCss: () => ipcRenderer.send("settings.customCssUpdate"),
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
