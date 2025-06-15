import { basename } from "path";
import { ClientPlugin, initializePluginCommandsWithIPC } from "@plugins/utils";
import { createLogger } from "@shared/utils/console";
import DOMPurify from "dompurify";
import { merge, set } from "lodash-es";
import pkg from "../../package.json";
import exposeData, { setContext } from "./base";
const appVersion = pkg.version;

const log = createLogger("YTMD");
setContext("appVersion", appVersion);
Object.entries(exposeData).forEach(([key, endpoints]) => {
	setContext(key, endpoints);
});

try {
	if (window.trustedTypes?.defaultPolicy?.name === "default")
		window.trustedTypes.createPolicy("default", {
			createHTML: (string) => DOMPurify.sanitize(string, { RETURN_TRUSTED_TYPE: true }) as any,
			createScriptURL: (string) => string, // warning: this is unsafe!
			createScript: (string) => string, // warning: this is unsafe!
		});
} catch {}
const plugins = (() => {
	const plugins = import.meta.glob("@plugins/youtube/*.plugin.ts", {
		eager: true,
	});
	return Object.entries(plugins)
		.map(([filename, p]: [string, any]) => {
			const m = basename(filename);
			let { meta, exec, afterInit } = p.default as ClientPlugin;
			const pluginLog = log.child(`Client Plugin, ${meta.name}`);
			if (meta) pluginLog.debug("enabled:", meta.enabled !== false);
			else return undefined;
			if (meta && meta.enabled === false) return undefined;
			return {
				file: m,
				exec,
				meta,
				afterInit,
				log: pluginLog,
				name: m.split(".").slice(0, -1).join("."),
			};
		})
		.filter((p) => p && p.meta && p.meta.enabled !== false);
})();
const settingsPromise = window.api.settingsProvider.getAll({}).then((x) => (window.__ytd_settings = merge({}, x)));
window.__ytd_plugins = Object.freeze(plugins);
const getPlayerApi = () => exposeData.domUtils.playerApi();
const initFn = async (force?: boolean) => {
	await settingsPromise;
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
				const pluginContext = { settings: new Proxy(window.__ytd_settings, {}), playerApi: getPlayerApi() };
				const destroyFns = await Promise.all(
					plugins.map(async (m) => {
						m.log.debug(m.name, m.meta);
						const destroyFn = await Promise.resolve(m.exec?.({ ...pluginContext, log: m.log, playerApi: getPlayerApi() }));
						return destroyFn;
					}),
				);
				window.addEventListener("beforeunload", async function () {
					if (destroyFns && currentUrl.hostname !== this.location.hostname && destroyFns.length > 0)
						await Promise.all(destroyFns.filter((fn) => fn && typeof fn === "function").map((fn) => Promise.resolve((fn as () => void)())));
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
				await Promise.all(
					plugins.map(async (p) => {
						if (!p.afterInit) return;
						await Promise.resolve(p.afterInit({ ...pluginContext, log: p.log, playerApi: getPlayerApi() }));
						log.child(`Client Plugin, ${p.name}`).debug(`afterInit execute`);
					}),
				);
				await Promise.all(plugins.map((p) => Promise.resolve(initializePluginCommandsWithIPC(p, { ...pluginContext, log: p.log, playerApi: getPlayerApi() }))));
			}
			window.api.emit("app.loadEnd");
			_loadedYTM = true; // todo

			resolve();
		}),
	);
};
setContext("__initYTMD", initFn);

process.on("loaded", () => {
	initFn();
});
