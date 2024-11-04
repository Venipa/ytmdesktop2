export const meta = {
  name: "Api Control Handler",
};

// todo
const trackControls = {
  toggle: () =>
    ((el) => el && el.click())(document.querySelector(".ytmusic-player-bar#play-pause-button")),
};
export const afterInit = () => {
  window.domUtils.ensureDomLoaded(() => {
    function setTimeSkip(_ev, data) {
      /**
       * @type {HTMLMediaElement}
       */
      if (data && typeof data.time === "number") {
        const playerApi = window.domUtils.playerApi();
        if (playerApi?.seekTo) {
          if (data.type === "seek") playerApi.seekTo(data.time / 1000);
          else playerApi.seekBy(data.time / 1000);
        }
      }
    }
    window.ipcRenderer.on("track:seek", setTimeSkip);
    window.ipcRenderer.on("track:control", (_ev, data) => {
      if (!data || typeof data === "object") return;
      const { type } = data;
      const handler = trackControls[type];
      if (!handler) return;
      handler();
    });
  });
};
