export const meta = {
  name: "Ad Skipper"
}

export const afterInit = () => {
  const PLAYER_TYPE_AD = 2;
  const SKIP_AD_POOLING_RATE_MS = 10;

  window.domUtils.ensureDomLoaded(() => {
    const playerApi = window.domUtils.playerApi();
    playerApi.addEventListener("onVideoDataChange", ev => {
      if (ev.playertype !== PLAYER_TYPE_AD) return;
      console.log("Found AD, skipping...", ev);
      var keepProbing = true;

      const onAd = async () => {
        await new Promise((resolve, _reject) => {
          const videoContainer = document.getElementById("movie_player");

          const skipAdHandler = () => {
            const isAd = videoContainer?.classList.contains("ad-interrupting") || videoContainer?.classList.contains("ad-showing");
            const skipLock = document.querySelector(".ytp-ad-preview-text-modern")?.innerText;

            if (isAd && skipLock) {
              const videoPlayer = document.getElementsByClassName("video-stream")[0];
              videoPlayer.muted = true;
              videoPlayer.currentTime = videoPlayer.duration - 0.01;
              videoPlayer.paused && videoPlayer.play()
              document.querySelector(".ytp-ad-skip-button")?.click();
              document.querySelector(".ytp-ad-skip-button-modern")?.click();
              keepProbing = false;
            }

            resolve();
          };

          setTimeout(skipAdHandler, SKIP_AD_POOLING_RATE_MS);
        });

        if (keepProbing) onAd();
      };

      onAd();
    })
  })
};
