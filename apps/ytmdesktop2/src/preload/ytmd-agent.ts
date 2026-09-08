/**
 * Main-world agent IIFE (page context only).
 * Readiness flags + `__YTMD_HOOK__` + Polymer controller trap. No Node.
 */
export const YTMD_AGENT_SOURCE = `(() => {
  window.__YTMD_HOOK__ = window.__YTMD_HOOK__ || {};
  try {
    var fakeBaseClass = function () {
      try {
        if (this.hostElement && this.hostElement.nodeName === "YTMUSIC-PLAYER-BAR") {
          window.__YTMD_HOOK__.ytmPlayerBar = this;
        }
        if (this.store && this.store.getState && this.store.dispatch && this.store.subscribe) {
          window.__YTMD_HOOK__.ytmStore = this.store;
        }
      } catch (e) {}
    };
    Object.defineProperty(window, "PolymerFakeBaseClassWithoutHtml", {
      configurable: true,
      set: function () {},
      get: function () { return fakeBaseClass; }
    });
  } catch (e2) {}

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

  function stealPlayerBar() {
    var hook = window.__YTMD_HOOK__;
    if (hook.ytmPlayerBar && hook.ytmPlayerBar.playerApi) return true;
    var el = document.querySelector("ytmusic-player-bar");
    if (!el) return false;
    if (el.playerApi) {
      hook.ytmPlayerBar = el;
      return true;
    }
    try {
      var keys = Object.getOwnPropertyNames(el);
      for (var i = 0; i < keys.length; i++) {
        if (!/playerController$/i.test(keys[i])) continue;
        var ctrl = el[keys[i]];
        if (ctrl && ctrl.playerApi) {
          hook.ytmPlayerBar = ctrl;
          return true;
        }
      }
    } catch (e3) {}
    if (typeof el.resolvePlayerApi === "function") {
      try {
        var api = el.resolvePlayerApi();
        if (api) {
          hook.ytmPlayerBar = { playerApi: api, hostElement: el };
          return !!api;
        }
      } catch (e4) {}
    }
    return !!(hook.ytmPlayerBar && hook.ytmPlayerBar.playerApi);
  }

  function logPlayerHook(via) {
    var api = window.__YTMD_HOOK__.ytmPlayerBar && window.__YTMD_HOOK__.ytmPlayerBar.playerApi;
    if (!api || window.__YTMD_HOOK__.__playerApiLogged) return;
    window.__YTMD_HOOK__.__playerApiLogged = true;
    console.info("[YTMD][page] hooked ytmPlayerBar.playerApi", via, document.readyState);
  }

  var late = document.readyState !== "loading";
  stealPlayerBar();
  hookStore();
  logPlayerHook(late ? "late" : "trap");

  if (!window.__YTMD_HOOK__.__ytmdPoll) {
    window.__YTMD_HOOK__.__ytmdPoll = 1;
    var started = Date.now();
    var timer = setInterval(function () {
      stealPlayerBar();
      hookStore();
      logPlayerHook(late ? "late" : "trap");
      var playerOk = !!(window.__YTMD_HOOK__.ytmPlayerBar && window.__YTMD_HOOK__.ytmPlayerBar.playerApi);
      if ((playerOk && hookStore()) || Date.now() - started > 20000) clearInterval(timer);
    }, 250);
  }

  if (window.__YTMD_AGENT__) {
    return;
  }
  window.__YTMD_AGENT__ = { version: 2 };
  let loaded = false;
  window.isYTMLoaded = function isYTMLoaded() {
    return loaded;
  };
  window.addEventListener("message", function (ev) {
    if (ev.data !== "ytmd-ready") return;
    loaded = true;
    console.info("[YTMD][page] got ytmd-ready", { origin: ev.origin, source: ev.source === window ? "same-window" : "other" });
  });
  console.info("[YTMD][page] agent injected, waiting for ytmd-ready", { readyState: document.readyState, late: late });
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
