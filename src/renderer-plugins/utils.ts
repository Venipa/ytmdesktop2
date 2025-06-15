import type { Logger } from "@shared/utils/console";
import type { PlayerApi } from "ytm-client-api";
type PluginSettings = Record<string, any>;

type PluginContext = {
	settings: PluginSettings;
	log: Logger;
	playerApi: PlayerApi;
};
type PluginOptions = {
	name: string;
	enabled: boolean;
	afterInit?: () => void;
};
type PluginDestroy = () => void | Promise<void>;
type PluginFn = (context: PluginContext) => PluginDestroy | void;
type PluginCmdFn = (context: PluginContext, ...args: any[]) => void;
type PluginExec =
	| PluginFn
	| {
			exec?: PluginFn;
			afterInit?: PluginFn;
			cmds?: Record<string, PluginCmdFn>;
	  };
export interface ClientPlugin {
	name: string;
	exec: PluginFn;
	afterInit?: PluginFn;
	cmds?: Record<string, PluginCmdFn>;
	meta: PluginOptions;
}
export default function definePlugin(name: string, options: Omit<PluginOptions, "name"> = { enabled: true }, fn: PluginExec): ClientPlugin {
	const isObject = typeof fn === "object";
	return {
		name,
		exec: isObject ? fn.exec || (() => {}) : fn,
		afterInit: isObject ? fn.afterInit : undefined,
		cmds: isObject ? fn.cmds : undefined,
		meta: {
			name,
			enabled: options.enabled,
		},
	};
}
export const pluginCommandKeySlug = (cmd: string) => cmd.replace(/\.?(?=[A-Z])/g, "_");
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
		const handler = (requestId: string, ...args: any[]) => {
			pluginContext.log.debug(`Received command ${cmd} with IPC`, { requestId, args });
			const response = fn(pluginContext, ...args);
			window.ipcRenderer.send(`plugins:${pluginName}:cmd:${commandKey}/response.${requestId}`, requestId, response);
			pluginContext.log.debug(`Sent response for command ${cmd} with IPC`, { requestId, response });
		};
		window.api.on(`plugins:${pluginName}:cmd:${commandKey}`, handler);
		loadedHandlers.set(cmd, handler);
		pluginContext.log.debug(`Initialized command ${cmd} with IPC`);
	});
	process.on("beforeExit", () => {
		loadedHandlers.forEach((handler, cmd) => {
			const commandKey = pluginCommandKeySlug(cmd);
			window.ipcRenderer.off(`plugins:${pluginName}:cmd:${commandKey}`, handler);
		});
	});
}
