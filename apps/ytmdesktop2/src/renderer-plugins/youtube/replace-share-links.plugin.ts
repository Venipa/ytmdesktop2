import definePlugin from "@plugins/utils";
import { YtmdLink } from "@shared/protocol/ytmdProtocol";

const SETTING_KEY = "player.replaceShareLinks";
const SHARE_URL_SELECTOR = "ytmusic-unified-share-panel-renderer input#share-url";
const HOOKED = "__ytmdShareUrlHooked";

type HookedInput = HTMLInputElement & { [HOOKED]?: boolean };

function rewriteUrl(url: string): string {
	const trimmed = url.trim();
	if (!trimmed || trimmed.startsWith(`${YtmdLink.scheme}:`)) return url;
	return YtmdLink.toYtmd(trimmed) ?? url;
}

/**
 * YTM sets `input.value` via JS (attribute often unchanged) — wrap the property
 * so Copy always reads `ytmd://…`.
 */
function hookShareUrlInput(input: HookedInput, isEnabled: () => boolean, log: { debug: (...args: unknown[]) => void }): void {
	if (input[HOOKED]) return;
	input[HOOKED] = true;

	const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
	if (!descriptor?.get || !descriptor?.set) {
		log.debug("share-url value descriptor missing — fallback assign only");
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

	// Panel may already have https in .value before we hook.
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

/**
 * Rewrite YTM unified share panel `input#share-url` to compact `ytmd://`.
 * Store has no share URL — DOM input is the source of truth for Copy.
 */
export default definePlugin(
	"replace-share-links",
	{
		enabled: true,
		displayName: "Replace Share Links",
	},
	{
		afterInit({ log, domUtils }) {
			let enabled = window.__ytd_settings?.player?.replaceShareLinks !== false;
			const isEnabled = () => enabled;

			const startObserver = () => {
				const root = document.querySelector("ytmusic-app") ?? document.body;
				scanShareUrlInputs(isEnabled, log);

				const observer = new MutationObserver(() => {
					if (!enabled) return;
					scanShareUrlInputs(isEnabled, log);
				});
				observer.observe(root, { childList: true, subtree: true });
			};

			domUtils.ensureDomLoaded(startObserver);

			// Backup: if YTM ever uses clipboard.writeText for Copy.
			const clipboard = navigator.clipboard;
			if (clipboard && typeof clipboard.writeText === "function") {
				const originalWriteText = clipboard.writeText.bind(clipboard);
				clipboard.writeText = async (data: string) => {
					const raw = String(data ?? "");
					const next = enabled ? rewriteUrl(raw) : raw;
					return originalWriteText(next);
				};
			}

			window.ipcRenderer.on("settingsProvider.change", (_ev, key: string, value: unknown) => {
				if (key === SETTING_KEY) {
					enabled = value !== false;
					if (enabled) scanShareUrlInputs(isEnabled, log);
					return;
				}
				if (key === "player" && value && typeof value === "object" && "replaceShareLinks" in value) {
					enabled = (value as { replaceShareLinks?: boolean }).replaceShareLinks !== false;
					if (enabled) scanShareUrlInputs(isEnabled, log);
				}
			});
		},
	},
);
