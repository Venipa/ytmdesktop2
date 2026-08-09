export type BridgeHandler = (...args: unknown[]) => unknown | Promise<unknown>;

export type BridgeRequest = {
	type: string;
	kind: "req";
	id: string;
	cmd: string;
	args: unknown[];
};

export type BridgeResponse =
	| { type: string; kind: "res"; id: string; ok: true; result: unknown }
	| { type: string; kind: "res"; id: string; ok: false; error: string };

/** Fire-and-forget (no id / no reply). */
export type BridgeNotify = {
	type: string;
	kind: "notify";
	cmd: string;
	args: unknown[];
};

export type BridgeListenLog = {
	error: (...args: unknown[]) => void;
};

export type DefineBridgeOptions = {
	/** Becomes `__ytmd_<name>` message type. */
	name: string;
	timeoutMs?: number;
};

export type PageBridge = {
	type: string;
	/** Preload: await page handler result. */
	request: <T = unknown>(cmd: string, ...args: unknown[]) => Promise<T>;
	/** Preload: fire-and-forget (boot / settings). */
	notify: (cmd: string, ...args: unknown[]) => void;
	/**
	 * Page world: handle `request` + `notify`.
	 * Returns disposer for `window` message listener.
	 */
	listen: (handlers: Record<string, BridgeHandler>, log?: BridgeListenLog) => () => void;
	/**
	 * Preload: build `definePlugin` cmds that forward to `request`.
	 * @example cmds: apiControls.pluginCmds("next", "seek", "volume")
	 */
	pluginCmds: <const C extends readonly string[]>(
		...cmds: C
	) => { [K in C[number]]: (ctx: unknown, ...args: unknown[]) => Promise<unknown> };
};

const DEFAULT_TIMEOUT_MS = 8_000;

function isRecord(data: unknown): data is Record<string, unknown> {
	return !!data && typeof data === "object";
}

function isBridgeResponse(data: unknown, type: string): data is BridgeResponse {
	return isRecord(data) && data.type === type && data.kind === "res" && typeof data.id === "string";
}

function isBridgeRequest(data: unknown, type: string): data is BridgeRequest {
	return (
		isRecord(data) &&
		data.type === type &&
		data.kind === "req" &&
		typeof data.id === "string" &&
		typeof data.cmd === "string"
	);
}

function isBridgeNotify(data: unknown, type: string): data is BridgeNotify {
	return isRecord(data) && data.type === type && data.kind === "notify" && typeof data.cmd === "string";
}

function makeId(prefix: string): string {
	return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Typed preload <-> page (world0) postMessage bridge.
 * Use for isolation: playerApi / store live in page; IPC cmds stay in preload.
 *
 * @example
 * ```ts
 * const bridge = defineBridge({ name: "api_controls" });
 * // preload plugin cmds
 * cmds: bridge.pluginCmds("next", "seek")
 * // page renderer
 * bridge.listen({ next: () => trackControls.next(player) })
 * ```
 */
export function defineBridge(options: DefineBridgeOptions): PageBridge {
	const type = `__ytmd_${options.name}`;
	const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const idPrefix = options.name.replace(/_/g, "-");

	function request<T = unknown>(cmd: string, ...args: unknown[]): Promise<T> {
		const id = makeId(idPrefix);
		return new Promise<T>((resolve, reject) => {
			const timer = window.setTimeout(() => {
				window.removeEventListener("message", onMessage);
				reject(new Error(`${options.name} bridge timed out (${cmd})`));
			}, timeoutMs);

			const onMessage = (ev: MessageEvent) => {
				if (!isBridgeResponse(ev.data, type) || ev.data.id !== id) return;
				window.clearTimeout(timer);
				window.removeEventListener("message", onMessage);
				if (!ev.data.ok) {
					reject(new Error(ev.data.error || `${options.name} ${cmd} failed`));
					return;
				}
				resolve(ev.data.result as T);
			};

			window.addEventListener("message", onMessage);
			const req: BridgeRequest = { type, kind: "req", id, cmd, args };
			window.postMessage(req, "*");
		});
	}

	function notify(cmd: string, ...args: unknown[]): void {
		const msg: BridgeNotify = { type, kind: "notify", cmd, args };
		window.postMessage(msg, "*");
	}

	function listen(handlers: Record<string, BridgeHandler>, log?: BridgeListenLog): () => void {
		const onMessage = (ev: MessageEvent) => {
			const data = ev.data;
			if (isBridgeRequest(data, type)) {
				const handler = handlers[data.cmd];
				if (!handler) {
					const error = `unknown ${options.name} cmd: ${data.cmd}`;
					log?.error(error);
					window.postMessage(
						{ type, kind: "res", id: data.id, ok: false, error } satisfies BridgeResponse,
						"*",
					);
					return;
				}
				void (async () => {
					try {
						const result = await Promise.resolve(handler(...(Array.isArray(data.args) ? data.args : [])));
						window.postMessage(
							{ type, kind: "res", id: data.id, ok: true, result } satisfies BridgeResponse,
							"*",
						);
					} catch (err) {
						const error = err instanceof Error ? err.message : String(err);
						log?.error(`cmd ${data.cmd} failed`, err);
						window.postMessage(
							{ type, kind: "res", id: data.id, ok: false, error } satisfies BridgeResponse,
							"*",
						);
					}
				})();
				return;
			}

			if (isBridgeNotify(data, type)) {
				const handler = handlers[data.cmd];
				if (!handler) return;
				void Promise.resolve(handler(...(Array.isArray(data.args) ? data.args : []))).catch((err) => {
					log?.error(`notify ${data.cmd} failed`, err);
				});
			}
		};

		window.addEventListener("message", onMessage);
		return () => window.removeEventListener("message", onMessage);
	}

	function pluginCmds<const C extends readonly string[]>(...cmds: C) {
		const out = {} as { [K in C[number]]: (ctx: unknown, ...args: unknown[]) => Promise<unknown> };
		for (const cmd of cmds) {
			out[cmd as C[number]] = async (_ctx: unknown, ...args: unknown[]) => request(cmd, ...args);
		}
		return out;
	}

	return { type, request, notify, listen, pluginCmds };
}

export type DefinePageCmdsOptions<TCmds extends Record<string, BridgeHandler>> = {
	/** Becomes `__ytmd_<name>` message type. */
	name: string;
	timeoutMs?: number;
	/** Page-world handlers. Keys = IPC / bridge cmd names. */
	cmds: TCmds;
};

export type PageCmds<TCmds extends Record<string, BridgeHandler>> = {
	type: string;
	name: string;
	/** Page handlers (same map passed in). */
	cmds: TCmds;
	/** Preload: await page handler. */
	request: <K extends keyof TCmds & string>(
		cmd: K,
		...args: Parameters<TCmds[K]>
	) => Promise<Awaited<ReturnType<TCmds[K]>>>;
	/** Preload: fire-and-forget. */
	notify: <K extends keyof TCmds & string>(cmd: K, ...args: Parameters<TCmds[K]>) => void;
	/** Preload `definePlugin` cmds that forward to `request`. */
	pluginCmds: {
		[K in keyof TCmds]: (
			ctx: unknown,
			...args: Parameters<TCmds[K]>
		) => Promise<Awaited<ReturnType<TCmds[K]>>>;
	};
	/** Page world: attach handlers. Returns disposer. */
	listen: (log?: BridgeListenLog) => () => void;
	/** Low-level bridge if needed. */
	bridge: PageBridge;
};

/**
 * Merge page cmd handlers + postMessage bridge.
 * One source of truth for IPC stub names and page implementations.
 *
 * @example
 * ```ts
 * const page = definePageCmds({
 *   name: "api_controls",
 *   cmds: { next: () => trackControls.next(player) },
 * });
 * // preload: cmds: page.pluginCmds
 * // page:    start: (ctx) => page.listen(ctx.log)
 * ```
 */
export function definePageCmds<const TCmds extends Record<string, BridgeHandler>>(
	options: DefinePageCmdsOptions<TCmds>,
): PageCmds<TCmds> {
	const bridge = defineBridge({ name: options.name, timeoutMs: options.timeoutMs });
	const cmdNames = Object.keys(options.cmds) as (keyof TCmds & string)[];

	const pluginCmds = {} as PageCmds<TCmds>["pluginCmds"];
	for (const cmd of cmdNames) {
		pluginCmds[cmd] = (async (_ctx: unknown, ...args: Parameters<TCmds[typeof cmd]>) =>
			bridge.request(cmd, ...args)) as PageCmds<TCmds>["pluginCmds"][typeof cmd];
	}

	return {
		type: bridge.type,
		name: options.name,
		cmds: options.cmds,
		request: ((cmd, ...args) => bridge.request(cmd, ...args)) as PageCmds<TCmds>["request"],
		notify: ((cmd, ...args) => bridge.notify(cmd, ...args)) as PageCmds<TCmds>["notify"],
		pluginCmds,
		listen: (log) => bridge.listen(options.cmds, log),
		bridge,
	};
}
