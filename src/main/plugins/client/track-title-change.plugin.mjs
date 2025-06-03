export const meta = {
	name: "Track watch title change",
	description: "Watch for track title changes",
	author: "Venipa <https://github.com/Venipa>",
	version: "1.0.0",
	enabled: true,
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
