export const meta = {
  name: "Track watch title change",
};

export default () => {
  new MutationObserver(() => {
    const el = document.querySelector("a.ytp-title-link.yt-uix-sessionlink");
    if (!el || !el.href) return;
    try {
      const videoUri = new URLSearchParams(el.href.split("?")[1]);
      if (!videoUri.has("v")) return;
      const videoId = videoUri.get("v");
      if (videoId) window.api.emit("track:title-change", videoId);
    } catch {}
  }).observe(document.querySelector("title"), {
    subtree: true,
    characterData: true,
    childList: true,
  });
};
