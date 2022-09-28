import IPC_EVENT_NAMES from "@/app/utils/eventNames";

const requiredClasses = ["video-stream", "html5-main-video"];
function getUITimeInfo() {
  const timeInfoId = 'ytmusic-player-bar[slot="player-bar"] .left-controls .time-info';
  const el = document.body.querySelector(timeInfoId);
  const parseTime = function (time) {
    const sec = time
      .split(":")
      .reverse()
      .map(Number)
      .reduce((current, part, index) => {
        if (index < 3)
          current +=
            index === 0
              ? part
              : index === 1
              ? Math.floor(part * 60)
              : index === 2
              ? Math.floor(part * 3600)
              : 0;
        return current;
      }, 0);
    return sec;
  };
  if (el) {
    const [start, end] = ((x) => (x && x.length > 1 ? x.map(parseTime) : [null, null]))(
      el.innerText.match(/(\d+)\:(\d+)/g)
    );
    return [start, end];
  }
  return null;
}
export default () => {
  const defaultPlay = HTMLVideoElement.prototype.play;
  const defaultPause = HTMLVideoElement.prototype.pause;
  const defaultLoad = HTMLVideoElement.prototype.load;
  const progressFnHookName = "ytmd-progressHook";
  /**
   * @this {HTMLVideoElement} this
   */
  function progressFn() {
    const uiTime = getUITimeInfo();
    window.api.emit(IPC_EVENT_NAMES.TRACK_PLAYSTATE, !this.paused, this.currentTime, uiTime);
  }
  HTMLVideoElement.prototype.play = function () {
    defaultPlay.call(this, ...arguments);
    if (requiredClasses.every((x) => this.classList.contains(x))) {
      const uiTime = getUITimeInfo();
      window.api.emit("track:play-state", !this.paused, this.currentTime, uiTime);
    }
  };
  HTMLVideoElement.prototype.pause = function () {
    defaultPause.call(this, ...arguments);
    if (requiredClasses.every((x) => this.classList.contains(x))) {
      const uiTime = getUITimeInfo();
      window.api.emit("track:play-state", !this.paused, this.currentTime, uiTime);
    }
  };
  HTMLVideoElement.prototype.load = function () {
    defaultLoad.call(this, ...arguments);
    if (!requiredClasses.every((x) => this.classList.contains(x))) return;
    if (
      !this.hasAttribute(progressFnHookName) ||
      this.getAttribute(progressFnHookName) !== "true"
    ) {
      this.setAttribute(progressFnHookName, "true");
      this.addEventListener("timeupdate", progressFn, { passive: true });
    }
  };
};
