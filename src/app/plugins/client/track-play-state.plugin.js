const requiredClasses = ["video-stream", "html5-main-video"];

export default () => {
  const defaultPlay = HTMLVideoElement.prototype.play;
  const defaultPause = HTMLVideoElement.prototype.pause;
  HTMLVideoElement.prototype.play = function() {
    defaultPlay.call(this, ...arguments);
    if (requiredClasses.every((x) => this.classList.contains(x)))
      window.api.emit("track:play-state", !this.paused, this.currentTime);
  };
  HTMLVideoElement.prototype.pause = function() {
    defaultPause.call(this, ...arguments);
    if (requiredClasses.every((x) => this.classList.contains(x)))
      window.api.emit("track:play-state", !this.paused, this.currentTime);
  };
};
