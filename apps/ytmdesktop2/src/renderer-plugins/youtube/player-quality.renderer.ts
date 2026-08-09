import type { RendererPluginRegistration } from "./world0/types";

const Q_KEY = "yt-player-quality";
const ENABLED_KEY = "player.res.enabled";
const PREFER_KEY = "player.res.prefer";

function setQuality(quality: string | null | undefined): void {
	if (!quality || quality === "auto") {
		localStorage.removeItem(Q_KEY);
		return;
	}
	const tc = Date.now();
	const te = tc + 2592000000;
	localStorage.setItem(Q_KEY, JSON.stringify({ data: quality, expiration: te, creation: tc }));
}

/** Persist preferred quality into YTM localStorage from settings. */
const playerQualityRenderer: RendererPluginRegistration = {
	id: "player-quality",
	enabled: true,
	async start(ctx) {
		let isEnabled = false;
		let currentQuality: string | null | undefined;

		try {
			const res = (await ctx.ytmd?.settings.get("player.res")) as
				| { enabled?: boolean; prefer?: string }
				| undefined;
			isEnabled = !!res?.enabled;
			currentQuality = res?.prefer;
		} catch {
			/* default off */
		}

		if (isEnabled) setQuality(currentQuality);
		else setQuality(null);

		const applyChange = (key: string, value: unknown) => {
			if (key === ENABLED_KEY && value !== isEnabled) {
				isEnabled = !!value;
				setQuality(isEnabled ? currentQuality : null);
				return;
			}
			if (key === PREFER_KEY && value !== currentQuality) {
				currentQuality = value as string;
				if (isEnabled) setQuality(currentQuality);
			}
		};

		const off = ctx.ytmd?.on("settingsProvider.change", (key, value) => {
			window.setTimeout(() => {
				if (key === "player.res") {
					const res = value as { enabled?: boolean; prefer?: string } | undefined;
					if (res?.prefer !== undefined) currentQuality = res.prefer;
					applyChange(ENABLED_KEY, res?.enabled);
					return;
				}
				applyChange(String(key), value);
			}, 1);
		});

		return () => {
			off?.();
		};
	},
};

export default playerQualityRenderer;
