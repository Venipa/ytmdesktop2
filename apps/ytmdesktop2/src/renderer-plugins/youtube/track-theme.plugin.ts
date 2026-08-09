import definePlugin from "@plugins/utils";

/** Apply main-pushed thumbnail CSS vars onto the YTM page. */
export default definePlugin(
	"track-theme",
	{
		enabled: true,
		displayName: "Track theme CSS",
	},
	({ domUtils, ytmd }) => {
		let thumbGen = 0;
		let accentGen = 0;
		let destroyThumb: (() => void) | undefined;
		let destroyAccent: (() => void) | undefined;

		const handleThumbnail = async (value: unknown) => {
			const gen = ++thumbGen;
			destroyThumb?.();
			destroyThumb = undefined;
			if (!value || typeof value !== "string") return;
			const destroy = await domUtils.createStyle(`:root { --ytmd-thumbnail-url: ${value}; }`);
			if (gen !== thumbGen) {
				destroy();
				return;
			}
			destroyThumb = destroy;
		};

		const handleAccent = async (value: unknown) => {
			const gen = ++accentGen;
			destroyAccent?.();
			destroyAccent = undefined;
			if (!value || typeof value !== "string") return;
			const destroy = await domUtils.createStyle(`:root { --ytmd-thumbnail-accent: ${value}; }`);
			if (gen !== accentGen) {
				destroy();
				return;
			}
			destroyAccent = destroy;
		};

		const unsubThumb = ytmd?.on("css.thumbnail", handleThumbnail) ?? (() => undefined);
		const unsubAccent = ytmd?.on("css.thumbnail-accent", handleAccent) ?? (() => undefined);

		return () => {
			unsubThumb();
			unsubAccent();
			destroyThumb?.();
			destroyAccent?.();
		};
	},
);
