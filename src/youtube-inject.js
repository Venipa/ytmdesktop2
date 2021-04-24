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


