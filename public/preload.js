const { contextBridge, ipcRenderer } = require("electron");
let exposedIpc = {
  emit: (event, ...data) => ipcRenderer.send(event, data),
  on: (channel, func) => ipcRenderer.on(channel, func),
};
contextBridge.exposeInMainWorld("ipcRenderer", exposedIpc);
