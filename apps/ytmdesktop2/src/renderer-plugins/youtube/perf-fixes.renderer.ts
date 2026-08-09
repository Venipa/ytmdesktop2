import { injectCpuTamer } from "@plugins/scripts/cpu-tamer";
import { injectRm3 } from "@plugins/scripts/rm3";
import type { RendererPluginRegistration } from "./world0/types";

/**
 * Run rm3 + cpu-tamer in page world after ytmd-ready.
 * Bundled into world0 IIFE (no Trusted Types script inject).
 */
const perfFixesRenderer: RendererPluginRegistration = {
	id: "perf-fixes",
	enabled: true,
	start(ctx) {
		let started = false;
		const inject = () => {
			if (started) return;
			started = true;
			try {
				injectRm3();
				injectCpuTamer();
				ctx.log.debug("performance fixes injected (post-load)");
			} catch (err) {
				ctx.log.error("performance fixes inject failed", err);
			}
		};

		const schedule = () => {
			window.setTimeout(inject, 250);
		};

		const onMessage = (ev: MessageEvent) => {
			if (ev.data === "ytmd-ready") schedule();
		};
		window.addEventListener("message", onMessage, { once: true });
		if (window.isYTMLoaded?.()) schedule();

		return () => {
			window.removeEventListener("message", onMessage);
		};
	},
};

export default perfFixesRenderer;
