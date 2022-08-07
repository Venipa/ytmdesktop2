// const requiredClasses = ["video-stream", "html5-main-video"];

export default () => {
  function setTimeSkip(_ev, data) {
    /**
     * @type {HTMLMediaElement}
     */
    let media;
    if (data && typeof data.time === "number") {
      if (
        (media = document.querySelector("video.video-stream.html5-main-video"))
      ) {
        if (data.type === "seek") media.currentTime = data.time / 1000;
        else media.currentTime += data.time / 1000;
      }
    }
  }
  window.ipcRenderer.on("track:seek", setTimeSkip);
};
