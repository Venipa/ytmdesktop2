import type { ClientPluginSerialized } from "../main/utils/pluginManager";
import type pd from "./base";

interface PreloadContext {
	api: typeof pd.api;
	domUtils: typeof pd.domUtils;
	ipcRenderer: typeof pd.ipcRenderer;
	process: typeof pd.process;
	pluginManager: {
		loadPlugins: () => Promise<void>;
		getPlugins: () => Promise<ClientPluginSerialized[]>;
		getPlugin: (name: string) => Promise<ClientPluginSerialized | undefined>;
		getEnabledPlugins: () => Promise<ClientPluginSerialized[]>;
	};
	__ytd_plugins: readonly ClientPluginSerialized[];
	__ytd_settings: any;
	__initYTMD: () => Promise<void>;
	isYTMLoaded: () => boolean;
}
declare global {
	declare const __dirname: string;
	interface Window extends globalThis, PreloadContext {
		[key: string]: any;
	}
}
