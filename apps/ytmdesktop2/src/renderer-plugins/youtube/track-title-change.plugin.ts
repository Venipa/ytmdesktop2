import definePlugin from "@plugins/utils";

export default definePlugin(
	"track-title-change",
	{
		enabled: true,
		displayName: "Track Title Change",
	},
	{
		afterInit() {
			let lastVideoId: string | null = null;
			const titleEl = document.querySelector("title");
			if (!titleEl) return;

			new MutationObserver(() => {
				const el = document.querySelector("a.ytp-title-link.yt-uix-sessionlink") as HTMLAnchorElement | null;
				if (!el?.href) return;
				try {
					const videoId = new URLSearchParams(el.href.split("?")[1]).get("v");
					if (!videoId || videoId === lastVideoId) return;
					lastVideoId = videoId;
					window.api.emit("track:title-change", videoId);
				} catch {
					/* ignore */
				}
			}).observe(titleEl, { subtree: true, characterData: true, childList: true });
		},
	},
);
