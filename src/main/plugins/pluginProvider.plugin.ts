import { AfterInit, BaseProvider, OnInit } from "@main/utils/baseProvider";
import { IpcContext, IpcHandle } from "@main/utils/onIpcEvent";
import { ClientPluginSerialized, PluginManager } from "@main/utils/pluginManager";
import { createLogger } from "@shared/utils/console";
import { App } from "electron";

const log = createLogger("PluginProvider");

@IpcContext
export default class PluginProvider extends BaseProvider implements OnInit, AfterInit {
	private pluginManager: PluginManager;

	constructor(private app: App) {
		super("plugins");
		this.pluginManager = new PluginManager();
	}

	async OnInit() {
		// Extract plugins from the built-in plugins directory
		const builtInPlugins = import.meta.glob("../plugins/client/*.plugin.mjs", {
			eager: true,
		});

		await this.pluginManager.extractPlugins(builtInPlugins);
		log.debug("Extracted built-in plugins");
	}

	async AfterInit() {
		// Additional initialization if needed
	}

	@IpcHandle("pluginManager.loaded")
	public async loaded(): Promise<ClientPluginSerialized[]> {
		await this.pluginManager.ensurePluginsLoaded();
		return this.pluginManager.loadedPlugins.map((p) => p.serialize());
	}

	@IpcHandle("pluginManager.getPlugin")
	public async getPlugin(name: string): Promise<ClientPluginSerialized | undefined> {
		await this.pluginManager.ensurePluginsLoaded();
		const plugin = this.pluginManager.loadedPlugins.find((p) => p.name === name);
		return plugin?.serialize();
	}

	@IpcHandle("pluginManager.getEnabledPlugins")
	public async getEnabledPlugins(): Promise<ClientPluginSerialized[]> {
		await this.pluginManager.ensurePluginsLoaded();
		return this.pluginManager.loadedPlugins.filter((p) => p.isEnabled).map((p) => p.serialize());
	}

	@IpcHandle("pluginManager.getPlugins")
	public async getPlugins(): Promise<ClientPluginSerialized[]> {
		await this.pluginManager.ensurePluginsLoaded();
		return this.pluginManager.loadedPlugins.map((p) => p.serialize());
	}
}
