import definePlugin from "@plugins/utils";

export default definePlugin(
	"internal:track-change-watcher",
	{
		enabled: true,
		displayName: "Track Change Watcher",
	},
	({ domUtils }) => {
		let thumbGen = 0;
		let accentGen = 0;
		let destroyThumb: (() => void) | undefined;
		let destroyAccent: (() => void) | undefined;

		const handleThumbnail = async (_ev: unknown, value: string) => {
			const gen = ++thumbGen;
			destroyThumb?.();
			destroyThumb = undefined;
			if (!value) return;
			const destroy = await domUtils.createStyle(`:root { --ytmd-thumbnail-url: ${value}; }`);
			if (gen !== thumbGen) {
				destroy();
				return;
			}
			destroyThumb = destroy;
		};

		const handleAccent = async (_ev: unknown, value: string) => {
			const gen = ++accentGen;
			destroyAccent?.();
			destroyAccent = undefined;
			if (!value) return;
			const destroy = await domUtils.createStyle(`:root { --ytmd-thumbnail-accent: ${value}; }`);
			if (gen !== accentGen) {
				destroy();
				return;
			}
			destroyAccent = destroy;
		};

		window.ipcRenderer.on("css.thumbnail", handleThumbnail);
		window.ipcRenderer.on("css.thumbnail-accent", handleAccent);

		return () => {
			window.ipcRenderer.off("css.thumbnail", handleThumbnail);
			window.ipcRenderer.off("css.thumbnail-accent", handleAccent);
			destroyThumb?.();
			destroyAccent?.();
		};
	},
);
