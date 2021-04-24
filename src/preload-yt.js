import { contextBridge } from "electron";
import { basename } from "path";
import exposeData from "./preload";

Object.entries(exposeData).forEach(([key, endpoints]) => {
  if (key === "api")
    endpoints = {
      ...endpoints,
      reloadCustomCss: () => ipcRenderer.send("settings.customCssUpdate"),
      watchCustomCss: (enabled) =>
        ipcRenderer.send("settings.customCssWatch", enabled)
    };
  try {
    contextBridge.exposeInMainWorld(key, endpoints);
  } catch { // backup to direct window api
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
  
  document.addEventListener("DOMContentLoaded", () => {
    window.__ytd_plugins = Object.freeze(plugins);
    plugins.forEach(m => {
      console.log('Client Plugin ::', m.name, m.exec);
      m.exec();
    });
  });
})();