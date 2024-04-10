import { contextBridge, ipcRenderer } from "electron";
import preloadRoot from "./base";


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
  function reportLoginSuccess() {
    ipcRenderer.send("g-login-success");
  }
  const prefixHost = "music.youtube";
  const isYoutubeWindow = window && document.location.host.indexOf(prefixHost) === 0;
  if (isYoutubeWindow) reportLoginSuccess();


  contextBridge.exposeInMainWorld("ytdapi", {
    isYoutubeWindow,
    api: preloadRoot.api,
    process: preloadRoot.process
  });
})()