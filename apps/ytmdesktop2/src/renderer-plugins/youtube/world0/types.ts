import type { PlayerApi } from "ytm-client-api";

/** Page-world (isolation world 0) context. Only `window.ytmd` + DOM. */
export interface RendererPluginContext {
	name: string;
	ytmd: {
		emit(event: string, ...args: unknown[]): void;
		on(event: string, handler: (...args: unknown[]) => void): () => void;
		settings: {
			getAll(): Promise<unknown>;
			get(key: string): Promise<unknown>;
			set(key: string, value: unknown): void;
		};
	} | null;
	log: {
		debug: (...args: unknown[]) => void;
		info: (...args: unknown[]) => void;
		warn: (...args: unknown[]) => void;
		error: (...args: unknown[]) => void;
	};
}

export type RendererPluginLifecycle = {
	start?: (ctx: RendererPluginContext) => void | (() => void) | Promise<void | (() => void)>;
	stop?: (ctx: RendererPluginContext) => void | Promise<void>;
	onConfigChange?: (key: string, value: unknown, ctx: RendererPluginContext) => void | Promise<void>;
	/** Fired once playerApi is ready in page world. Prefer this for player listeners. */
	onPlayerApiReady?: (playerApi: PlayerApi, ctx: RendererPluginContext) => void | Promise<void>;
};

export type RendererPluginRegistration = RendererPluginLifecycle & {
	id: string;
	enabled?: boolean;
};
