import { contextBridge } from "electron";
import { get, merge, set } from "lodash-es";
import preloadRoot from "./preload";

Object.entries(preloadRoot).forEach(([key, endpoints]) => {
  contextBridge.exposeInMainWorld(key, endpoints);
});

(async function() {
  let settings = {};
  await preloadRoot.api.settingsProvider.getAll({}).then((x) => {
    settings = merge(settings, x);
  });
  contextBridge.exposeInMainWorld("settings", {
    get: (key) => get(settings, key),
  });
  document.addEventListener("DOMContentLoaded", () => {
    preloadRoot.ipcRenderer.on("settingsProvider.change", (ev, key, value) => {
      if (settings) set(settings, key, value);
      console.log("api:update-setting", key, value);
    });
  });
})();

