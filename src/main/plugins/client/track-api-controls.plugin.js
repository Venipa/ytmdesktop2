export const meta = {
  name: "Api Control Handler",
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
  });
};
