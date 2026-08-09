import type { RendererPluginRegistration } from "./world0/types";

const THUMB_STYLE_ID = "ytmd-track-theme-thumbnail";
const ACCENT_STYLE_ID = "ytmd-track-theme-accent";

function setRootStyle(id: string, cssText: string | null): void {
	const existing = document.getElementById(id);
	if (!cssText) {
		existing?.remove();
		return;
	}
	let el = existing as HTMLStyleElement | null;
	if (!el) {
		el = document.createElement("style");
		el.id = id;
		(document.head ?? document.documentElement).appendChild(el);
	}
	el.textContent = cssText;
}

/** Apply main-pushed thumbnail CSS vars in page world (ytmd push allowlist). */
const trackThemeRenderer: RendererPluginRegistration = {
	id: "track-theme",
	enabled: true,
	start(ctx) {
		const handleThumbnail = (value: unknown) => {
			if (!value || typeof value !== "string") {
				setRootStyle(THUMB_STYLE_ID, null);
				return;
			}
			setRootStyle(THUMB_STYLE_ID, `:root { --ytmd-thumbnail-url: ${value}; }`);
		};

		const handleAccent = (value: unknown) => {
			if (!value || typeof value !== "string") {
				setRootStyle(ACCENT_STYLE_ID, null);
				return;
			}
			setRootStyle(ACCENT_STYLE_ID, `:root { --ytmd-thumbnail-accent: ${value}; }`);
		};

		const unsubThumb = ctx.ytmd?.on("css.thumbnail", handleThumbnail) ?? (() => undefined);
		const unsubAccent = ctx.ytmd?.on("css.thumbnail-accent", handleAccent) ?? (() => undefined);

		return () => {
			unsubThumb();
			unsubAccent();
			setRootStyle(THUMB_STYLE_ID, null);
			setRootStyle(ACCENT_STYLE_ID, null);
		};
	},
};

export default trackThemeRenderer;
