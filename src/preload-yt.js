import { contextBridge } from "electron";
import { basename } from "path";
import { set, merge } from "lodash-es";
import exposeData from "./preload";
let exposedMain = false;
Object.entries(exposeData).forEach(([key, endpoints]) => {
  if (key === "api")
    endpoints = {
      ...endpoints,
      reloadCustomCss: () => ipcRenderer.send("settings.customCssUpdate"),
      watchCustomCss: (enabled) =>
        ipcRenderer.send("settings.customCssWatch", enabled),
    };
  try {
    contextBridge.exposeInMainWorld(key, endpoints);
    if (!exposedMain) exposedMain = true;
  } catch {
    // backup to direct window api
    window[key] = Object.freeze(endpoints);
  }
});

(() => {
  const window = document.defaultView;
  const plugins = (() => {
    const plugins = require.context(
      "@/app/plugins/client",
      false,
      /plugin.js$/
    );
    return plugins.keys().map((m) => {
      const func = plugins(m).default;
      return {
        file: m,
        exec: func,
        name: basename(m),
      };
    });
  })();
  window.__ytd_settings = {};
  let _loadedYTM = false;
  window.isYTMLoaded = () => {
    return _loadedYTM;
  };

  window.api.settingsProvider
    .getAll({})
    .then((x) => (window.__ytd_settings = merge({}, window.__ytd_settings, x)));
  window.ipcRenderer.on("settingsProvider.change", (ev, key, value) => {
    console.log("settings.change", key, value);
    window.__ytd_settings = set(window.__ytd_settings, key, value);
  });
  document.addEventListener("DOMContentLoaded", () => {
    window.__ytd_plugins = Object.freeze(plugins);
    const pluginContext = { settings: new Proxy(window.__ytd_settings, {}) };
    plugins.forEach((m) => {
      console.log("Client Plugin ::", m.name, m.exec);
      m.exec(pluginContext);
    });
    window.api.emit("app.loadEnd");
    _loadedYTM = true; // todo
  });
})();
