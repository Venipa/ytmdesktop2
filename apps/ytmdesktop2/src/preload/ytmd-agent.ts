/**
 * Main-world agent IIFE (page context only).
 * Readiness flags + `__YTMD_HOOK__` bag + store capture from DOM. No Node.
 */
export const YTMD_AGENT_SOURCE = `(() => {
  if (window.__YTMD_AGENT__) {
    console.info("[YTMD][page] agent already present");
    return;
  }
  window.__YTMD_AGENT__ = { version: 1 };
  window.__YTMD_HOOK__ = window.__YTMD_HOOK__ || {};
  let loaded = false;
  window.isYTMLoaded = function isYTMLoaded() {
    return loaded;
  };
  window.addEventListener("message", function (ev) {
    if (ev.data !== "ytmd-ready") return;
    loaded = true;
    console.info("[YTMD][page] got ytmd-ready", { origin: ev.origin, source: ev.source === window ? "same-window" : "other" });
  });
  console.info("[YTMD][page] agent injected, waiting for ytmd-ready");

  function isYtmStore(value) {
    return !!(value && typeof value === "object" && typeof value.getState === "function" && typeof value.dispatch === "function");
  }

  function findStore() {
    try {
      var queueHost = document.querySelector("#queue");
      var fromQueue = queueHost && queueHost.queue && queueHost.queue.store && queueHost.queue.store.store;
      if (isYtmStore(fromQueue)) return fromQueue;
    } catch (e) {}
    var selectors = ["ytmusic-app", "ytmusic-app-layout>ytmusic-player-bar", "ytmusic-player-bar"];
    for (var i = 0; i < selectors.length; i++) {
      try {
        var el = document.querySelector(selectors[i]);
        if (el && isYtmStore(el.store)) return el.store;
      } catch (e2) {}
    }
    return null;
  }

  function hookStore() {
    if (isYtmStore(window.__YTMD_HOOK__.ytmStore)) return true;
    var store = findStore();
    if (!store) return false;
    window.__YTMD_HOOK__.ytmStore = store;
    return true;
  }

  hookStore();
  var started = Date.now();
  var timer = setInterval(function () {
    if (hookStore() || Date.now() - started > 20000) clearInterval(timer);
  }, 250);
})();`;

/** Re-run page-world store capture (after preload finds store on DOM). */
export const YTMD_STORE_PAGE_HOOK_SOURCE = `(() => {
  window.__YTMD_HOOK__ = window.__YTMD_HOOK__ || {};
  function isYtmStore(value) {
    return !!(value && typeof value === "object" && typeof value.getState === "function" && typeof value.dispatch === "function");
  }
  if (isYtmStore(window.__YTMD_HOOK__.ytmStore)) return true;
  function findStore() {
    try {
      var queueHost = document.querySelector("#queue");
      var fromQueue = queueHost && queueHost.queue && queueHost.queue.store && queueHost.queue.store.store;
      if (isYtmStore(fromQueue)) return fromQueue;
    } catch (e) {}
    var selectors = ["ytmusic-app", "ytmusic-app-layout>ytmusic-player-bar", "ytmusic-player-bar"];
    for (var i = 0; i < selectors.length; i++) {
      try {
        var el = document.querySelector(selectors[i]);
        if (el && isYtmStore(el.store)) return el.store;
      } catch (e2) {}
    }
    return null;
  }
  var store = findStore();
  if (!store) return false;
  window.__YTMD_HOOK__.ytmStore = store;
  return true;
})();`;
