const injectTrackListener = () => {
  let _xhr = window.XMLHttpRequest;
  function trackXHR() {
    const xhr = new _xhr();
    xhr.addEventListener(
      "readystatechange",
      async () => {
        if (xhr.readyState == 4 && xhr.status == 200) {
          try {
            const url = new URL(xhr.responseURL);
            if (url && url.pathname.match(/^\/youtubei\/v1\/player/)) {
              const json = JSON.parse(xhr.responseText);
              if (!json || !json.videoDetails) return;
              window.ipcRenderer.emit(
                "track:info-req",
                json
                  ? {
                      video: json.videoDetails,
                      context: json.microformat ? json.microformat.microformatDataRenderer : null,
                    }
                  : null
              );
            }
          } catch {
            // maybe return no track?
          }
        }
      },
      { passive: true }
    );
    return xhr;
  }
  window.XMLHttpRequest = trackXHR;
};
export default injectTrackListener;
