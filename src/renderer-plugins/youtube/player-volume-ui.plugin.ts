import definePlugin from "@plugins/utils";

export default definePlugin(
	"player-volume-ui",
	{
		enabled: true,
		displayName: "Youtube Player Volume UI",
		throwOnError: false,
	},
	{
		async afterInit({ settings, domUtils, log, playerApi }) {
			if (!import.meta.env.DEV) throw new Error("Player volume UI is still in development");
			if (!settings.volumeRatio?.enabled) return;

			domUtils.ensureDomLoaded(async () => {
				const volumeSlider = await domUtils.awaitElement<HTMLInputElement>("ytmusic-player-bar ytmusic-player-bar-player-volume-slider");
			});
		},
	},
);
