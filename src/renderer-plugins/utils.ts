import type { PluginContext } from "@preload/pluginManager";
type PluginOptions = {
	name: string;
	enabled: boolean;
	displayName: string;
	afterInit?: () => void;
	restartNeeded?: boolean;
};
type PluginDestroy = () => void | Promise<void>;
type PluginFn = (context: PluginContext) => PluginDestroy | void;
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
	displayName: string;
	exec: PluginFn;
	afterInit?: PluginFn;
	cmds?: Record<string, PluginCmdFn>;
	meta: PluginOptions;
}
/**
 * definePlugin is a helper function to define a plugin.
 * It is used to define a plugin and its commands.
 * @param name - The name of the plugin
 * @param options - The options for the plugin
 * @param fn - The plugin function or an object with exec, afterInit, and cmds properties
 * @returns The internal plugin object instance
 */
export default function definePlugin(name: string, options: Omit<PluginOptions, "name"> = { enabled: true, displayName: name }, fn: PluginExec): ClientPlugin {
	const isObject = typeof fn === "object";
	return {
		name,
		displayName: options.displayName,
		exec: (isObject ? fn.exec : fn) || (() => {}),
		afterInit: isObject ? fn.afterInit : undefined,
		cmds: isObject ? fn.cmds : undefined,
		meta: {
			name,
			enabled: options.enabled,
			displayName: options.displayName,
			restartNeeded: options.restartNeeded,
		},
	};
}
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
	const pluginName = plugin.name.replace(/:/g, "_");
	Object.entries(cmds).forEach(([cmd, fn]) => {
		const commandKey = pluginCommandKeySlug(cmd);
		const handler = async (ev: unknown, { requestId, payload }: { requestId: string; payload: any[] }) => {
			pluginContext.log.debug(`Received command \`${cmd}\` with IPC`, { requestId, payload });
			const response = await Promise.resolve(fn(pluginContext, ...(Array.isArray(payload) ? payload : [payload])));
			window.ipcRenderer.send(`plugins:${pluginName}:cmd:${commandKey}/response.${requestId}`, requestId, response);
			pluginContext.log.debug(`Sent response for command \`${cmd}\` with IPC`, { requestId, response });
		};
		window.api.on(`plugins:${pluginName}:cmd:${commandKey}`, handler);
		loadedHandlers.set(cmd, handler);
		pluginContext.log.debug(`Initialized command \`${cmd}\` with IPC\ncall via \`plugins:${pluginName}:cmd:${commandKey}\``);
	});
	process.on("beforeExit", () => {
		loadedHandlers.forEach((handler, cmd) => {
			const commandKey = pluginCommandKeySlug(cmd);
			window.ipcRenderer.off(`plugins:${pluginName}:cmd:${commandKey}`, handler);
		});
	});
}
