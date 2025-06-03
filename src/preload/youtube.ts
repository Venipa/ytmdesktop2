import { createLogger } from "@shared/utils/console";
import DOMPurify from "dompurify";
import { merge, set } from "lodash-es";
import pkg from "../../package.json";
import { ClientPluginSerialized } from "../main/utils/pluginManager";
import exposeData, { setContext } from "./base";

const appVersion = pkg.version;

const log = createLogger("YTD");
setContext("appVersion", appVersion);
Object.entries(exposeData).forEach(([key, endpoints]) => {
	setContext(key, endpoints);
});

// Extended type for loaded plugins that includes execution functions
interface LoadedPlugin extends ClientPluginSerialized {
	exec?: Function;
	afterInit?: Function;
}
const createTrustedPolicy = () => {
	try {
		if (window.trustedTypes?.defaultPolicy?.name === "default")
			window.trustedTypes.createPolicy("default", {
				createHTML: (string) => DOMPurify.sanitize(string, { RETURN_TRUSTED_TYPE: true }) as any,
				createScriptURL: (string) => string, // warning: this is unsafe!
				createScript: (string) => string, // warning: this is unsafe!
				createScriptURLFromSource: (string) => string, // warning: this is unsafe!
			});
	} catch {}
};

createTrustedPolicy();

// Initialize plugin manager and load plugins
const pluginsPromise = window.pluginManager.getEnabledPlugins().then(async (plugins: ClientPluginSerialized[]) => {
	log.debug(`pluginsPromise`, plugins);

	const loadedPlugins: LoadedPlugin[] = [];
	for await (const plugin of plugins) {
		log.debug("plugin loading", plugin.name, plugin.filepath);
		const module = await import(window.trustedTypes.defaultPolicy.createScriptURL(plugin.filepath) as any, {
			assert: { type: "module" },
		});
		if (!module) continue;
		log.debug("plugin loaded", plugin.name, module);
		loadedPlugins.push({
			...plugin,
			exec: module.default,
			afterInit: module.afterInit,
		} as LoadedPlugin);
	}
	window.__ytd_plugins = loadedPlugins.filter(Boolean) as LoadedPlugin[];
	return window.__ytd_plugins;
});

const settingsPromise = window.api.settingsProvider.getAll({}).then((x) => (window.__ytd_settings = merge({}, x)));
const initFn = async (force?: boolean) => {
	await settingsPromise;
	await pluginsPromise;
	log.debug(
		"window.__ytd_plugins loaded",
		window.__ytd_plugins.map((p) => p.name),
	);
	if (window.isYTMLoaded?.() && !force) throw new Error("YTMD is already loaded, " + appVersion);
	let _loadedYTM = false;
	window.isYTMLoaded = () => {
		return _loadedYTM;
	};

	window.ipcRenderer.on("settingsProvider.change", (ev, key, value) => {
		log.debug("settings.change", key, value);
		window.__ytd_settings = set(window.__ytd_settings, key, value);
	});
	await new Promise<void>((resolve) =>
		exposeData.domUtils.ensureDomLoaded(async () => {
			const currentUrl = new URL(location.href);
			if (currentUrl.host === "music.youtube.com") {
				const pluginContext = { settings: new Proxy(window.__ytd_settings, {}) };
				const destroyFns = window.__ytd_plugins.map((m: LoadedPlugin) => {
					if (m.meta) log.child(`Client Plugin, ${m.meta.name}`).debug("enabled:", m.enabled);
					else log.child(`Client Plugin, ${m.name}`).debug(m.name, m.meta);
					if (!m.enabled) return undefined;
					const destroyFn = m.exec?.(pluginContext);
					return destroyFn;
				});
				window.addEventListener("beforeunload", function () {
					if (destroyFns && currentUrl.hostname !== this.location.hostname && destroyFns.length > 0)
						destroyFns.filter((fn) => fn && typeof fn === "function").forEach((fn) => fn());
				});
				let timeoutHandle: any;
				await new Promise<void>((wr, reject) => {
					let checkHandle: any;
					const checkYTRoot = () => {
						if (!timeoutHandle)
							timeoutHandle = setTimeout(() => {
								clearTimeout(checkHandle);
								reject(new Error("Unable to hook yt player"));
							}, 30 * 1000);
						const ready = !!exposeData.domUtils.playerApi()?.isReady();
						if (!ready) {
							checkHandle = setTimeout(checkYTRoot, 100);
						} else {
							clearTimeout(checkHandle);
							clearTimeout(timeoutHandle);
							wr();
						}
					};
					checkYTRoot();
				});

				log.debug("ytplayer loaded");
				window.__ytd_plugins.forEach((p: LoadedPlugin) => {
					log.child(`Client Plugin, ${p.name}`).debug(`afterInit execute`, p);
					if (!p.afterInit || !p.enabled) return;
					p.afterInit(pluginContext);
					log.child(`Client Plugin, ${p.name}`).debug(`afterInit execute`);
				});
			}
			window.api.emit("app.loadEnd");
			_loadedYTM = true;

			resolve();
		}),
	);
};
setContext("__initYTMD", initFn);

process.on("loaded", async () => {
	initFn();
});
