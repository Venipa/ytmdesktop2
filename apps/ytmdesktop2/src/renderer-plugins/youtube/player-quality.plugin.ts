import definePlugin from "@plugins/utils";

const qKey = "yt-player-quality";
export default definePlugin(
	"player-quality",
	{
		enabled: true,
		displayName: "Preferred quality",
	},
	({ onSettingsChange }) => {
		const res = window.__ytd_settings?.player?.res;
		let isEnabled = !!res?.enabled;
		let currentQuality = res?.prefer;
		function setQuality(quality: string | null | undefined) {
			if (!quality || quality === "auto") return localStorage.removeItem(qKey);
			const tc = Date.now();
			const te = tc + 2592000000;
			return localStorage.setItem(qKey, JSON.stringify({ data: quality, expiration: te, creation: tc }));
		}
		if (isEnabled) setQuality(res.prefer);
		else setQuality(null);

		function handleChange(key: string, value: unknown) {
			if (key === "player.res.enabled" && value != isEnabled) {
				isEnabled = !!value;
				setQuality(window.__ytd_settings?.player?.res?.prefer);
			} else if (key === "player.res.prefer" && value !== currentQuality) {
				currentQuality = value as string;
				setQuality(value as string);
			}
		}
		onSettingsChange((key, value) => {
			setTimeout(() => {
				if (key === "player.res") {
					handleChange("player.res.enabled", (value as { enabled?: boolean } | undefined)?.enabled);
				} else handleChange(key, value);
			}, 1);
		});
	},
);
