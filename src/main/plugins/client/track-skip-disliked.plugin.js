export const meta = {
  name: "Track skip disliked",
};

export default ({ settings }) => {
  let lastVideoId = null,
    waitForTick = false;
  window.ipcRenderer.on("track.change", (ev, id) => {
    const skipDisliked = settings.player && settings.player.skipDisliked;
    if (id && skipDisliked && lastVideoId != id && !waitForTick) {
      lastVideoId = id;
      const playerBar = document.querySelector("ytmusic-player-bar");
      if (playerBar) {
        waitForTick = true;
        setTimeout(() => {
          if (playerBar.querySelector('#like-button-renderer[like-status="DISLIKE"]')) {
            playerBar.querySelector('tp-yt-paper-icon-button[icon="yt-icons:skip_next"]').click();
          }
          waitForTick = false;
        }, 1000);
      }
    }
  });
};
