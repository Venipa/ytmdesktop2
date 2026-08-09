import type { PluginContext } from "@preload/pluginManager";
import { createLogger, Logger } from "@shared/utils/console";
import { createPluginHandleName, pluginCommandKeySlug } from "@shared/ytm";
import type { ServiceName } from "ytmd";
import type { RendererPluginLifecycle } from "./youtube/world0/types";

export { createPluginHandleName, pluginCommandKeySlug };
export type { RendererPluginLifecycle };

export type PluginOptions = {
	name: string;
	// services in main process that this plugin depends on
	service?: ServiceName;
	enabled: boolean;
	displayName: string;
	throwOnError?: boolean;
	afterInit?: () => void;
	restartNeeded?: boolean;
};
type PluginDestroy = () => void | Promise<void>;
type PluginFn = (context: PluginContext) => Promise<void> | void | PluginDestroy;
type PluginCmdFn = (context: PluginContext, ...args: any[]) => void;
/** Isolated-preload lifecycle (cmds / React / settings stay here). */
export type PreloadPluginLifecycle = {
	start?: PluginFn;
	afterInit?: PluginFn;
	onConfigChange?: (key: string, value: unknown, context: PluginContext) => void | Promise<void>;
};
type PluginExec =
	| PluginFn
	| {
			exec?: PluginFn;
			afterInit?: PluginFn;
			/** Prefer this over bare exec/afterInit for new plugins. */
			preload?: PreloadPluginLifecycle;
			/**
			 * Page-world hooks. Default-export from `*.renderer.ts`; world-0 host globs those files.
			 * Declaring here documents ownership for preload meta; host glob is the runtime source of truth.
			 */
			renderer?: RendererPluginLifecycle;
			/**
			 * Create a command handler for the plugin, these can be called via IPC `plugins:${pluginName}:cmd:${commandKey}`
			 *
			 * ----
			 *
			 * creating a command named `updateVolume` will be called via IPC `plugins:${pluginName}:cmd:update_volume`
			 * the command handler will be called with the plugin context and the arguments passed to the command
			 *
			 * if using `createSendHandler` the command handler will be called with the requestId and the payload:
			 * the command handler should return a value that will be sent back to the caller via IPC `plugins:${pluginName}:cmd:update_volume/response.${requestId}`
			 */
			cmds?: Record<string, PluginCmdFn>;
	  };
export interface ClientPlugin {
	name: string;
	service?: ServiceName;
	displayName: string;
	exec: PluginFn;
	afterInit?: PluginFn;
	cmds?: Record<string, PluginCmdFn>;
	renderer?: RendererPluginLifecycle;
	onConfigChange?: (key: string, value: unknown, context: PluginContext) => void | Promise<void>;
	meta: PluginOptions;
}
function handleAsyncFn(fn: PluginFn, log: Logger, options: PluginOptions) {
	const originalFn = fn;
	let executingPromise: Promise<void> | undefined;

	const newFnExec = async (context: any) => {
		try {
			if (executingPromise) return executingPromise;
			executingPromise = Promise.resolve(originalFn(context)).finally(() => (executingPromise = undefined)) as Promise<any>;
			return await executingPromise;
		} catch (error) {
			log.error("Error executing plugin", error);
			if (options.throwOnError) throw error;
			return undefined;
		} finally {
			executingPromise = undefined;
		}
	};
	return newFnExec;
}
function resolvePluginFns(pluginExec: PluginExec): {
	exec?: PluginFn;
	afterInit?: PluginFn;
	onConfigChange?: PreloadPluginLifecycle["onConfigChange"];
	renderer?: RendererPluginLifecycle;
	cmds?: Record<string, PluginCmdFn>;
} {
	if (typeof pluginExec !== "object") {
		return { exec: pluginExec };
	}
	const preload = pluginExec.preload;
	return {
		exec: pluginExec.exec ?? preload?.start,
		afterInit: pluginExec.afterInit ?? preload?.afterInit,
		onConfigChange: preload?.onConfigChange,
		renderer: pluginExec.renderer,
		cmds: pluginExec.cmds,
	};
}
function applyAsyncFnHandler(pluginExec: PluginExec, _pluginName: string, log: Logger, options: PluginOptions) {
	const resolved = resolvePluginFns(pluginExec);
	return {
		exec: resolved.exec ? handleAsyncFn(resolved.exec, log, options) : undefined,
		afterInit: resolved.afterInit ? handleAsyncFn(resolved.afterInit, log, options) : undefined,
		onConfigChange: resolved.onConfigChange,
		renderer: resolved.renderer,
		cmds: resolved.cmds,
	};
}
const noopPluginFn: PluginFn = () => undefined;
/**
 * definePlugin is a helper function to define a plugin.
 * It is used to define a plugin and its commands.
 * @param name - The name of the plugin
 * @param options - The options for the plugin
 * @param fn - The plugin function or an object with exec, afterInit, and cmds properties
 * @returns The internal plugin object instance
 */
export default function definePlugin(name: string, options: Omit<PluginOptions, "name"> = { enabled: true, displayName: name, throwOnError: true }, fn: PluginExec): ClientPlugin {
	const log = createLogger("YTMD").child("plugin").child(name);
	const isObject = typeof fn === "object";
	const pluginExec = applyAsyncFnHandler(fn, name, log, options as PluginOptions);
	const service = options.service;
	const hasWork = !!(pluginExec.exec || pluginExec.afterInit || pluginExec.cmds || pluginExec.renderer);
	if (!hasWork) {
		log.debug("plugin has no preload hooks (renderer-only or stub)");
	}
	return {
		name,
		displayName: options.displayName,
		exec: pluginExec.exec ?? noopPluginFn,
		afterInit: pluginExec.afterInit ?? noopPluginFn,
		cmds: isObject ? pluginExec.cmds : undefined,
		renderer: pluginExec.renderer,
		onConfigChange: pluginExec.onConfigChange,
		meta: {
			name,
			service,
			enabled: options.enabled,
			displayName: options.displayName,
			restartNeeded: options.restartNeeded,
			throwOnError: options.throwOnError,
		},
	};
}
/**
 * Initialize plugin commands with IPC
 * Command names are slugified, so `cmd.name` becomes `cmd_name` or `cmdName` becomes `cmd_name`
 * Example:
 * ```ts
 * definePlugin("myPluginName", {
 *   enabled: true,
 * }, {
 *   cmds: {
 *     "updateVolume": (context, volume) => {
 *       context.log.info(`Updating volume to ${volume}`);
 *     }
 *   }
 * });
 * ```
 * `updateVolume` becomes `update_volume` if used with [createSendHandler](../main/utils/ipc.ts)
 *
 * @param plugin - The plugin to initialize commands for
 * @param pluginContext - The plugin context
 * @returns void
 */
export function initializePluginCommandsWithIPC(plugin: ClientPlugin, pluginContext: PluginContext) {
	const { cmds } = plugin;
	if (!cmds) return;
	const loadedHandlers = new Map<string, () => void>();
	const handleName = plugin.meta.service ? createPluginHandleName(plugin.meta.service) : createPluginHandleName(plugin.name);
	const ytmd = pluginContext.ytmd as
		| {
				onInternal?: (event: string, handler: (...args: unknown[]) => void) => () => void;
				sendInternal?: (event: string, ...args: unknown[]) => void;
		  }
		| null
		| undefined;

	Object.entries(cmds).forEach(([cmd, fn]) => {
		const commandKey = pluginCommandKeySlug(cmd);
		const commandChannel = `plugins:${handleName}:cmd:${commandKey}`;
		const handler = async (...raw: unknown[]) => {
			const msg = raw[0] as { requestId: string; payload: any[] };
			const requestId = msg?.requestId;
			const payload = msg?.payload;
			pluginContext.log.debug(`cmd \`${cmd}\``, { requestId, payload });
			const response = await Promise.resolve(fn(pluginContext, ...(Array.isArray(payload) ? payload : [payload])));
			if (ytmd?.sendInternal) {
				ytmd.sendInternal(`${commandChannel}/response.${requestId}`, requestId, response);
			} else {
				window.ipcRenderer.send(`${commandChannel}/response.${requestId}`, requestId, response);
			}
			pluginContext.log.debug(`cmd \`${cmd}\` ok`, { requestId, response });
		};

		let dispose: () => void;
		if (ytmd?.onInternal) {
			// onInternal strips the Electron event; main sends a single payload object.
			dispose = ytmd.onInternal(commandChannel, (...args) => void handler(...args));
		} else {
			const ipcHandler = (_ev: unknown, msg: { requestId: string; payload: any[] }) => void handler(msg);
			window.api.on(commandChannel, ipcHandler);
			dispose = () => window.ipcRenderer.off(commandChannel, ipcHandler);
		}
		loadedHandlers.set(cmd, dispose);
		pluginContext.log.debug(`cmd \`${cmd}\` ready (\`${commandChannel}\`)`);
	});
	process.on("beforeExit", () => {
		loadedHandlers.forEach((dispose) => dispose());
	});
}
