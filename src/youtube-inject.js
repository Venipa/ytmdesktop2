/**
 * initializeYoutubeDesktop
 * @param {{customCss: string}} options
 */
const initializeYoutubeDesktop = function(options) {
  console.log('ytd2-options', options);
  if (window.desktop) return;
  function createHtml(html) {
    var template = document.createElement("template");
    template.innerHTML = html;
    return template.content.childNodes;
  }

  const initializeElements = () => {
    try {
      const css = document.createElement("style");
      css.appendChild(
        document.createTextNode(`
      /* Youtube Desktop 2 */
      ${options.customCss}`)
      );
      document.head.appendChild(css);
      const materialIcons = document.createElement("link");
      materialIcons.setAttribute(
        "href",
        "https://fonts.googleapis.com/icon?family=Material+Icons"
      );
      materialIcons.setAttribute("rel", "stylesheet");

      document.body.prepend(materialIcons);
      console.log(css);
    } catch (err) {
      console.error(err);
    }
    /**
     * @type {HTMLElement}
     */
    const element = createHtml(`<button class="ytd-nav-button ytd-nav-button-icon" role="button" tabindex="0" aria-disabled="false">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
    <path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
    </svg>
    </button>`)[0];
    element.onclick = (ev) => {
      ev.preventDefault();
      window.app.settings.open();
    };
    const nav = document.querySelector(".ytmusic-nav-bar#right-content");
    nav.insertBefore(element, nav.querySelector(".settings-button"));
  };
  window.desktop = true;
  console.log("ytd2", "Initializing Elements");
  initializeElements();
};
