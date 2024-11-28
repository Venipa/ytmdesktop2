
export const meta = {
  name: "Api Control Handler",
};
// todo
const trackControls = {
  toggle: player => {
    const state = player.getPlayerStateObject();
    if (!state) return;
    state.isPlaying ? player.pauseVideo() : player.playVideo()
    return {
      isPlaying: state.isPlaying,
      time: player.getCurrentTime()
    };
  },
  play: playerApi => {
    playerApi.playVideo()
    return {
      isPlaying: true,
      time: playerApi.getCurrentTime()
    }
  },
  pause: playerApi => {
    playerApi.pauseVideo()
    return {
      isPlaying: false,
      time: playerApi.getCurrentTime()
    }
  },
  next: playerApi => playerApi.nextVideo(),
  prev: playerApi => playerApi.previousVideo(),
  isPlaying: player => {
    const state = player.getPlayerStateObject();
    if (!state) return;
    return state.isPlaying;
  }
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
    window.ipcRenderer.on("track:control", async (_ev, data) => {
      if (!data || typeof data !== "object") return;
      const { type } = data;
      const handler = trackControls[type];
      if (!handler) return;
      const playerApi = window.domUtils.playerApi();
      // not ready yet
      if (!playerApi) return;

      const handleResult = await Promise.resolve(handler(playerApi));
      window.api.emit("track:control/response", {
        type,
        data: handleResult
      })

    });
  });
};
