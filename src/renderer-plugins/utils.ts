import type { PluginContext } from "@preload/pluginManager";
import { createLogger, Logger } from "@shared/utils/console";
import type { ServiceName } from "ytmd";

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
type PluginExec =
	| PluginFn
	| {
			exec?: PluginFn;
			afterInit?: PluginFn;
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
function applyAsyncFnHandler(pluginExec: PluginExec, pluginName: string, log: Logger, options: PluginOptions) {
	const isObject = typeof pluginExec === "object";
	const asyncFnKeys = ["exec", "afterInit"];
	asyncFnKeys.forEach((key) => {
		const fn = (isObject ? (pluginExec as any)[key] : pluginExec) as PluginFn;
		if (fn && typeof fn === "function") {
			(isObject ? (pluginExec as any)[key] : pluginExec)[key] = handleAsyncFn(fn, log, options) as any;
		}
	});
	return {
		exec: isObject ? (pluginExec as any).exec : pluginExec,
		afterInit: isObject ? (pluginExec as any).afterInit : undefined,
	} as {
		exec: PluginFn;
		afterInit: PluginFn | undefined;
	};
}
/**
 * definePlugin is a helper function to define a plugin.
 * It is used to define a plugin and its commands.
 * @param name - The name of the plugin
 * @param options - The options for the plugin
 * @param fn - The plugin function or an object with exec, afterInit, and cmds properties
 * @returns The internal plugin object instance
 */
export default function definePlugin(name: string, options: Omit<PluginOptions, "name"> = { enabled: true, displayName: name, throwOnError: true }, fn: PluginExec): ClientPlugin {
	const log = createLogger(`Plugin`).child(name);
	const isObject = typeof fn === "object";
	const pluginExec = applyAsyncFnHandler(fn, name, log, options as PluginOptions);
  const service = options.service;
	return {
		name,
		displayName: options.displayName,
		exec:
			pluginExec.exec ??
			((() => {
				log.warn("Plugin exec is not defined, using default empty function");
			}) as PluginFn),
		afterInit:
			pluginExec.afterInit ??
			((() => {
				log.warn("Plugin afterInit is not defined, using default empty function");
			}) as PluginFn),
		cmds: isObject ? fn.cmds : undefined,
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
export const createPluginHandleName = (pluginName: string) => pluginName.replace(/:/g, "_");
// example: `togglePlayback` becomes `toggle_playback`
export const pluginCommandKeySlug = (cmd: string) => cmd.replace(/\.?(?=[A-Z])/g, "_").toLowerCase();
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
	const loadedHandlers = new Map<string, any>();
	const handleName = plugin.meta.service ? createPluginHandleName(plugin.meta.service) : createPluginHandleName(plugin.name);
	Object.entries(cmds).forEach(([cmd, fn]) => {
		const commandKey = pluginCommandKeySlug(cmd);
		const commandChannel = `plugins:${handleName}:cmd:${commandKey}`;
		const handler = async (ev: unknown, { requestId, payload }: { requestId: string; payload: any[] }) => {
			pluginContext.log.debug(`Received command \`${cmd}\` with IPC`, { requestId, payload });
			const response = await Promise.resolve(fn(pluginContext, ...(Array.isArray(payload) ? payload : [payload])));
			window.ipcRenderer.send(`${commandChannel}/response.${requestId}`, requestId, response);
			pluginContext.log.debug(`Sent response for command \`${cmd}\` with IPC`, { requestId, response });
		};
		window.api.on(commandChannel, handler);
		loadedHandlers.set(cmd, handler);
		pluginContext.log.debug(`Initialized command \`${cmd}\` with IPC\ncall via \`${commandChannel}\``);
	});
	process.on("beforeExit", () => {
		loadedHandlers.forEach((handler, cmd) => {
			const commandKey = pluginCommandKeySlug(cmd);
			window.ipcRenderer.off(`plugins:${handleName}:cmd:${commandKey}`, handler);
		});
	});
}
