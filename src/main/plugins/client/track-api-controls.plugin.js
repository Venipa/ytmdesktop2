export const meta = {
  name: "Api Control Handler",
};
// todo
const trackControls = {
  toggle: player => {
    const state = player.getPlayerStateObject();
    if (!state) return;
    return (state.isPlaying || state.isOrWillBePlaying) ? player.stopVideo() : player.playVideo()
  },
  play: playerApi => playerApi.playVideo(),
  pause: playerApi => playerApi.stopVideo(),
  next: playerApi => playerApi.nextVideo(),
  prev: playerApi => playerApi.previousVideo()
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
      const playerApi = window.domUtils.playerApi();
      window.api.emit("track:control/response", type, handler(playerApi))
    });
  });
};
