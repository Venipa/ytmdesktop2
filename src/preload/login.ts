import { ipcRenderer } from "electron"


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
  if (window && document.location.host.indexOf(prefixHost) === 0) reportLoginSuccess();
})()