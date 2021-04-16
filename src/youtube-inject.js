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



console.log('ytd2-track-watch', 'init', 'title =>', !!document.querySelector("title").childNodes[0]);
const trackObservers = {
  "track:title": () => {
    ipcRenderer.emit(
      "track:title",
      document.querySelector(".title.ytmusic-player-bar").textContent
    );
  },
  "track:info": () => {
    ipcRenderer.emit(
      "track:info",
      document.querySelector(".ytp-title-link.yt-uix-sessionlink").href
    );
  },
};

new MutationObserver(function() {
  Object.values(trackObservers).forEach((runner) => runner());
}).observe(document.querySelector(".ytp-title").childNodes[0], {
  childList: true,
  subtree: true
});