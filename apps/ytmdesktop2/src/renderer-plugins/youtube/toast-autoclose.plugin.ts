import definePlugin from "@plugins/utils";

const AUTO_CLOSE_MS = 3_000;

type Toast = HTMLElement & { close?: () => void };

/** YTM liked-music (and similar) toasts never auto-dismiss - close after 3s. */
export default definePlugin(
	"toast-autoclose",
	{ enabled: true, displayName: "Toast auto-close" },
	{
		afterInit({ domUtils }) {
			const timers = new WeakMap<Toast, ReturnType<typeof setTimeout>>();

			const arm = (toast: Toast) => {
				if (timers.has(toast)) return;
				timers.set(
					toast,
					setTimeout(() => {
						timers.delete(toast);
						if (!toast.classList.contains("paper-toast-open")) return;
						const btn = toast.querySelector<HTMLElement>("#close-button button");
						if (btn) btn.click();
						else toast.close?.();
					}, AUTO_CLOSE_MS),
				);
			};

			domUtils.ensureDomLoaded(() => {
				const root = document.querySelector("ytmusic-app") ?? document.body;
				const scan = () => root.querySelectorAll<Toast>("tp-yt-paper-toast.paper-toast-open").forEach(arm);
				scan();
				new MutationObserver(scan).observe(root, {
					childList: true,
					subtree: true,
					attributes: true,
					attributeFilter: ["class"],
				});
			});
		},
	},
);
