import definePlugin from "@plugins/utils";

const afterInit = () => {
	new MutationObserver(() => {
		const el = document.querySelector("a.ytp-title-link.yt-uix-sessionlink") as HTMLAnchorElement;
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

export default definePlugin(
	"track-title-change",
	{
		enabled: true,
		displayName: "Track Title Change",
	},
	{ afterInit },
);
