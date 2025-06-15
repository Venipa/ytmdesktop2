import definePlugin from "@plugins/utils";

const qKey = "yt-player-quality";
export default definePlugin(
	"Youtube Prefer Quality",
	{
		enabled: true,
	},
	() => {
		const res = window.__ytd_settings?.player?.res;
		let isEnabled = !!res?.enabled;
		let currentQuality = res?.prefer;
		function setQuality(quality) {
			console.log(quality);
			if (!quality || quality === "auto") return localStorage.removeItem(qKey);
			const tc = Date.now(),
				te = tc + 2592000000;
			return localStorage.setItem(qKey, JSON.stringify({ data: quality, expiration: te, creation: tc }));
		}
		if (isEnabled) setQuality(res.prefer);
		else setQuality(null);

		function handleChange(key, value) {
			if (key === "player.res.enabled" && value != isEnabled) {
				isEnabled = value;
				setQuality(window.__ytd_settings?.player?.res?.prefer);
			} else if (key === "player.res.prefer" && value !== currentQuality) {
				currentQuality = value;
				setQuality(value);
			}
		}
		window.ipcRenderer.on("settingsProvider.change", function (ev, key, value) {
			setTimeout(() => {
				if (key === "player.res") {
					handleChange("player.res.enabled", value?.enabled);
				} else handleChange(key, value);
			}, 1);
		});
	},
);
