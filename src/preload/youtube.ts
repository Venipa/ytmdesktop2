import { contextBridge } from "electron";
import { merge, set } from "lodash-es";
import { basename } from "path";
import exposeData from "./base";
let exposedMain = false;
Object.entries(exposeData).forEach(([key, endpoints]) => {
  if (key === "api")
    endpoints = {
      ...endpoints,
      reloadCustomCss: () => window.ipcRenderer.emit("settings.customCssUpdate"),
      watchCustomCss: (enabled) =>
        window.ipcRenderer.emit("settings.customCssWatch", enabled),
    } as any as typeof endpoints;
  try {
    contextBridge.exposeInMainWorld(key, endpoints);
    if (!exposedMain) exposedMain = true;
  } catch {
    // backup to direct window api
    window[key] = Object.freeze(endpoints);
  }
});

(() => {

  function ensureDomLoaded(f) {
    if (["interactive", "complete"].indexOf(document.readyState) > -1) {
      f()
    }
    else {
      let triggered = false
      document.addEventListener("DOMContentLoaded", () => {
        if (!triggered) {
          triggered = true
          setTimeout(f, 1)
        }
      })
    }
  }
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
        name: basename(m)
      };
    });
  })();
  window.__ytd_settings = {};
  let _loadedYTM = false;
  window.isYTMLoaded = () => {
    return _loadedYTM;
  };

  const settingsLoadPromise = window.api.settingsProvider
    .getAll({})
    .then((x) => (window.__ytd_settings = merge({}, window.__ytd_settings, x)));
  window.ipcRenderer.on("settingsProvider.change", (ev, key, value) => {
    console.log("settings.change", key, value);
    window.__ytd_settings = set(window.__ytd_settings, key, value);
  });
  settingsLoadPromise.finally(() => {
    ensureDomLoaded(() => {
      window.__ytd_plugins = Object.freeze(plugins);
      const pluginContext = { settings: new Proxy(window.__ytd_settings, {}) };
      const destroyFns = plugins.map((m) => {
        console.log("Client Plugin ::", m.name, m.exec);
        const destroyFn = m.exec(pluginContext);
        return destroyFn;
      });
      const currentUrl = new URL(location.href);
      window.addEventListener("beforeunload",
      function () {
        if (destroyFns && currentUrl.hostname !== this.location.hostname && destroyFns.length > 0)
          destroyFns.filter(fn => fn && typeof fn === "function").forEach(fn => fn());
      })
      window.api.emit("app.loadEnd");
      _loadedYTM = true; // todo

    })
  })
})();
