import definePlugin from "@plugins/utils";

export default definePlugin(
	"internal:track-change-watcher",
	{
		enabled: true,
		displayName: "Track Change Watcher",
	},
	({ domUtils }) => {
		function handleChange(_ev, value: string) {
			domUtils.createStyle(`:root { --ytmd-thumbnail-url: ${value}; }`); // ! todo: add working css for track change watcher
		}
		domUtils.ensureDomLoaded(() => {
			window.ipcRenderer.on("css.thumbnail", handleChange);
		});
	},
);
