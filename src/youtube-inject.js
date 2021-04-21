/**
 * initializeYoutubeDesktop
 */
const initializeYoutubeDesktop = function() {};

/**
 * initializeYoutubeCustomCSS
 * @param {{customCss: string}} options
 */
const initializeYoutubeCustomCSS = function(options) {
  console.log("ytd2-customcss", options);
  /**
   * @type {HTMLStyleElement} style
   */
  let style = document.head.querySelector(`style[data-ytd="customcss"]`);
  if (!style) {
    style = document.createElement("style");
    style.innerText = options.customCss;
    style.dataset.ytd = "customcss";
    document.head.appendChild(style);
  } else {
    style.innerText = options.customCss;
  }
};

console.log(
  "ytd2-track-watch",
  "init",
  "title =>",
  !!document.querySelector("title").childNodes[0]
);
const trackObservers = {
  "track:title": () => {
    const title =
      document.querySelector(".title.ytmusic-player-bar") ||
      document.querySelector(".song-title[title]");
    ipcRenderer.emit("track:title", title.textContent);
    ipcRenderer.emitTo(
      __ytd_window_data.toolbarView,
      "track:title",
      title.textContent
    );
  },
  "track:info": () => {
    const title =
        document.querySelector(".title.ytmusic-player-bar") ||
        document.querySelector(".song-title[title]"),
      url = document.querySelector(".ytp-title-link.yt-uix-sessionlink").href;
    ipcRenderer.emit("track:info", {
      url,
      title,
    });
  },
};
window.ipcRenderer.on("window-title-updated", () => {
  Object.values(trackObservers).forEach((runner) => runner());
});
const updateTrack = new MutationObserver(function(mutations) {
  Object.values(trackObservers).forEach((runner) => runner());
});
document.querySelectorAll(".ytp-title").forEach((x) => {
  updateTrack.observe(x.childNodes[0].parentNode, {
    childList: true,
    subtree: true,
  });
});
