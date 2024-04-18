export const meta = {
  name: "Track info watcher"
}

export const afterInit = () => {
  const videoDataChangeLoadedType = ["dataupdated", "dataloaded"]
  window.domUtils.ensureDomLoaded(() => {
    const playerApi = window.domUtils.playerApi();
    playerApi.addEventListener("onVideoDataChange", ev => {
      console.log("onVideoDataChange", ev);
      if (ev.playertype !== 1 || !videoDataChangeLoadedType.includes(ev.type)) return;
      const videoData = playerApi.getPlayerResponse();
      const requestData = { video: videoData.videoDetails, context: videoData.microformat && videoData.microformat.microformatDataRenderer || null };
      console.log("requestData", requestData);
      window.ipcRenderer.emit("track:info-req", requestData);
    })
  })
};
