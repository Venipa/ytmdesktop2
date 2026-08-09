import { YTM_READY_CHANNEL, type YtmEmitEvent, type YtmPageBridge, type YtmPushEvent } from "@shared/ytm";
import { ipcRenderer } from "electron";

/** Channels page-world `ytmd.emit` may send to main. */
const EMIT_ALLOWLIST = new Set<string>([
	"track:info-req",
	"track:like-state",
	"track:play-state",
	"track:play-state-progress",
	"track:title-change",
	"app.loadEnd",
]);

/** Channels page-world `ytmd.on` may subscribe to. */
const PUSH_ALLOWLIST = new Set<string>([
	"settingsProvider.change",
	"trackId:change",
	"css.thumbnail",
	"css.thumbnail-accent",
]);

function assertEmitAllowed(event: string): void {
	if (EMIT_ALLOWLIST.has(event)) return;
	throw new Error(`ytmd.emit blocked: ${event}`);
}

function assertPushAllowed(event: string): void {
	if (PUSH_ALLOWLIST.has(event)) return;
	throw new Error(`ytmd.on blocked: ${event}`);
}

export interface PreloadYtmdHost extends YtmPageBridge {
	/** Preload-only: subscribe without allowlist (plugin cmds). */
	onInternal(event: string, handler: (...args: unknown[]) => void): () => void;
	/** Preload-only: send without allowlist. */
	sendInternal(event: string, ...args: unknown[]): void;
}

/**
 * Build bridge used by page (`contextBridge`) and preload plugins.
 * Page surface is allowlisted; preload host keeps full IPC for cmds.
 */
export function createYtmdBridge(settingsProvider: {
	getAll: (...args: unknown[]) => Promise<unknown>;
	get: (...args: unknown[]) => Promise<unknown>;
	set: (key: string, value: unknown) => void;
}): PreloadYtmdHost {
	const onInternal = (event: string, handler: (...args: unknown[]) => void): (() => void) => {
		const wrapped = (_ev: Electron.IpcRendererEvent, ...args: unknown[]) => handler(...args);
		ipcRenderer.on(event, wrapped);
		return () => {
			ipcRenderer.off(event, wrapped);
		};
	};

	const sendInternal = (event: string, ...args: unknown[]): void => {
		ipcRenderer.send(event, ...args);
	};

	const bridge: PreloadYtmdHost = {
		emit(event: YtmEmitEvent, ...args: unknown[]): void {
			assertEmitAllowed(String(event));
			ipcRenderer.send(String(event), ...args);
		},
		on(event: YtmPushEvent, handler: (...args: unknown[]) => void): () => void {
			assertPushAllowed(String(event));
			return onInternal(String(event), handler);
		},
		settings: {
			getAll: () => settingsProvider.getAll({}),
			get: (key: string) => settingsProvider.get(key),
			set: (key: string, value: unknown) => settingsProvider.set(key, value),
		},
		onInternal,
		sendInternal,
	};

	return bridge;
}

/** Register `YtmClient.isReady()` responder in preload. */
export function registerYtmdReadyHandler(isReady: (opts: { requirePlayer: boolean }) => boolean): () => void {
	const handler = (_ev: Electron.IpcRendererEvent, msg: { requestId: string; payload?: unknown[] }) => {
		const requestId = msg?.requestId;
		if (!requestId) return;
		const raw = Array.isArray(msg.payload) ? msg.payload[0] : undefined;
		const requirePlayer = !(raw && typeof raw === "object" && (raw as { requirePlayer?: boolean }).requirePlayer === false);
		const ready = !!isReady({ requirePlayer });
		ipcRenderer.send(`${YTM_READY_CHANNEL}/response.${requestId}`, requestId, ready);
	};
	ipcRenderer.on(YTM_READY_CHANNEL, handler);
	return () => {
		ipcRenderer.off(YTM_READY_CHANNEL, handler);
	};
}
