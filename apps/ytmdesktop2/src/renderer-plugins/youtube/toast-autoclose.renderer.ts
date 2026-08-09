import type { RendererPluginRegistration } from "./world0/types";

const AUTO_CLOSE_MS = 3_000;

type Toast = HTMLElement & { close?: () => void };

/** YTM liked-music (and similar) toasts never auto-dismiss - close after 3s. */
const toastAutocloseRenderer: RendererPluginRegistration = {
	id: "toast-autoclose",
	enabled: true,
	start() {
		const timers = new WeakMap<Toast, ReturnType<typeof setTimeout>>();
		let observer: MutationObserver | null = null;

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

		const root = document.querySelector("ytmusic-app") ?? document.body;
		const scan = () => root.querySelectorAll<Toast>("tp-yt-paper-toast.paper-toast-open").forEach(arm);
		scan();
		observer = new MutationObserver(scan);
		observer.observe(root, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ["class"],
		});

		return () => {
			observer?.disconnect();
			observer = null;
		};
	},
};

export default toastAutocloseRenderer;
