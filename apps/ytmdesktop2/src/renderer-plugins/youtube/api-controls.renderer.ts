import { queueListSignature } from "./api-controls.cmds";
import { apiControlsPage } from "./api-controls.page";
import type { RendererPluginRegistration } from "./world0/types";
import { resolveYtmStore } from "./ytm-store";

const STORE_HOOK_MS = 250;
const STORE_HOOK_MAX_MS = 20_000;
const QUEUE_EMIT_MS = 160;

const apiControlsRenderer: RendererPluginRegistration = {
	id: "api-controls",
	enabled: true,
	async start(ctx) {
		const offListen = apiControlsPage.listen(ctx.log);
		let unsubStore: (() => void) | undefined;
		let hookTimer: ReturnType<typeof setInterval> | null = null;
		let emitTimer: ReturnType<typeof setTimeout> | null = null;
		let lastSig = "";

		const readSig = () => {
			const queue = resolveYtmStore()?.getState?.()?.queue;
			const items = queue?.items ?? [];
			return { items, sig: queueListSignature(items, queue?.queueContextParams) };
		};

		const emitQueue = () => {
			const { items, sig } = readSig();
			if (sig === lastSig) return;
			lastSig = sig;
			try {
				ctx.ytmd?.emit("nav:queue-change", { count: items.length, sig });
			} catch (err) {
				ctx.log.error("nav:queue-change emit failed", err);
			}
		};

		const scheduleEmit = () => {
			if (emitTimer) clearTimeout(emitTimer);
			emitTimer = setTimeout(() => {
				emitTimer = null;
				emitQueue();
			}, QUEUE_EMIT_MS);
		};

		const bindStore = (): boolean => {
			if (unsubStore) return true;
			const store = resolveYtmStore();
			if (!store?.subscribe) return false;
			lastSig = readSig().sig;
			unsubStore = store.subscribe(scheduleEmit);
			return true;
		};

		if (!bindStore()) {
			const startedAt = Date.now();
			hookTimer = setInterval(() => {
				if (bindStore() || Date.now() - startedAt > STORE_HOOK_MAX_MS) {
					if (hookTimer) clearInterval(hookTimer);
					hookTimer = null;
				}
			}, STORE_HOOK_MS);
		}

		return () => {
			offListen();
			unsubStore?.();
			if (hookTimer) clearInterval(hookTimer);
			if (emitTimer) clearTimeout(emitTimer);
		};
	},
};

export default apiControlsRenderer;
