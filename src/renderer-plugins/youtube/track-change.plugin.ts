import definePlugin from "@plugins/utils";

export default definePlugin(
	"internal:track-change-watcher",
	{
		enabled: true,
		displayName: "Track Change Watcher",
	},
	({ domUtils }) => {
		let destroyStyle: () => void;
		async function handleThumbnail(_ev, value: string) {
			if (destroyStyle) destroyStyle();
			if (value) destroyStyle = await domUtils.createStyle(`:root { --ytmd-thumbnail-url: ${value}; }`); // ! todo: add working css for track change watcher
		}
		let destroyAccent: () => void;
		async function handleAccent(_ev, value: string) {
			if (destroyAccent) destroyAccent();
			if (value) destroyAccent = await domUtils.createStyle(`:root { --ytmd-thumbnail-accent: ${value}; }`); // ! todo: add working css for track change watcher
		}
		domUtils.ensureDomLoaded(() => {
			window.ipcRenderer.on("css.thumbnail", handleThumbnail);
			window.ipcRenderer.on("css.thumbnail-accent", handleAccent);
		});
	},
);
