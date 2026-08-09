import { YtmdLink } from "@shared/protocol/ytmdProtocol";
import type { RendererPluginRegistration } from "./world0/types";

const SETTING_KEY = "player.replaceShareLinks";
const SHARE_URL_SELECTOR = "ytmusic-unified-share-panel-renderer input#share-url";
const HOOKED = "__ytmdShareUrlHooked";

type HookedInput = HTMLInputElement & { [HOOKED]?: boolean };

function rewriteUrl(url: string): string {
	const trimmed = url.trim();
	if (!trimmed || trimmed.startsWith(`${YtmdLink.scheme}:`)) return url;
	return YtmdLink.toYtmd(trimmed) ?? url;
}

function hookShareUrlInput(input: HookedInput, isEnabled: () => boolean, log: { debug: (...args: unknown[]) => void }): void {
	if (input[HOOKED]) return;
	input[HOOKED] = true;

	const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
	if (!descriptor?.get || !descriptor?.set) {
		log.debug("share-url value descriptor missing, fallback assign only");
		if (isEnabled()) {
			const next = rewriteUrl(input.value);
			if (next !== input.value) input.value = next;
		}
		return;
	}

	Object.defineProperty(input, "value", {
		configurable: true,
		enumerable: true,
		get() {
			return descriptor.get!.call(this);
		},
		set(next: string) {
			const raw = String(next ?? "");
			const rewritten = isEnabled() ? rewriteUrl(raw) : raw;
			if (isEnabled() && rewritten !== raw) {
				log.debug("rewrote share-url input", { from: raw, to: rewritten });
			}
			descriptor.set!.call(this, rewritten);
		},
	});

	if (isEnabled()) {
		const current = descriptor.get.call(input);
		const rewritten = rewriteUrl(String(current ?? ""));
		if (rewritten !== current) descriptor.set.call(input, rewritten);
	}
}

function scanShareUrlInputs(isEnabled: () => boolean, log: { debug: (...args: unknown[]) => void }): void {
	document.querySelectorAll<HookedInput>(SHARE_URL_SELECTOR).forEach((input) => {
		hookShareUrlInput(input, isEnabled, log);
	});
}

/** Rewrite share panel URL to compact ytmd://. Runs in page world. */
const replaceShareLinksRenderer: RendererPluginRegistration = {
	id: "share-links",
	enabled: true,
	async start(ctx) {
		let enabled = true;
		try {
			const v = await ctx.ytmd?.settings.get(SETTING_KEY);
			if (v === false) enabled = false;
		} catch {
			/* default on */
		}
		const isEnabled = () => enabled;

		const root = document.querySelector("ytmusic-app") ?? document.body;
		scanShareUrlInputs(isEnabled, ctx.log);

		const observer = new MutationObserver(() => {
			if (!enabled) return;
			scanShareUrlInputs(isEnabled, ctx.log);
		});
		observer.observe(root, { childList: true, subtree: true });

		const clipboard = navigator.clipboard;
		if (clipboard && typeof clipboard.writeText === "function") {
			const originalWriteText = clipboard.writeText.bind(clipboard);
			clipboard.writeText = async (data: string) => {
				const raw = String(data ?? "");
				const next = enabled ? rewriteUrl(raw) : raw;
				return originalWriteText(next);
			};
		}

		const off = ctx.ytmd?.on("settingsProvider.change", (key, value) => {
			if (key === SETTING_KEY) {
				enabled = value !== false;
				if (enabled) scanShareUrlInputs(isEnabled, ctx.log);
				return;
			}
			if (key === "player" && value && typeof value === "object" && "replaceShareLinks" in (value as object)) {
				enabled = (value as { replaceShareLinks?: boolean }).replaceShareLinks !== false;
				if (enabled) scanShareUrlInputs(isEnabled, ctx.log);
			}
		});

		return () => {
			observer.disconnect();
			off?.();
		};
	},
};

export default replaceShareLinksRenderer;
