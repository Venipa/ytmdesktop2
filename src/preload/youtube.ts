import { basename } from "path";
import { createLogger } from "@shared/utils/console";
import DOMPurify from "dompurify";
import { merge, set } from "lodash-es";
import pkg from "../../package.json";
import exposeData, { setContext } from "./base";
const appVersion = pkg.version;

const log = createLogger("YTD");
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
	const plugins = import.meta.glob("../main/plugins/client/*.plugin.js", {
		eager: true,
	});
	return Object.entries(plugins).map(([filename, p]: [string, any]) => {
		const m = basename(filename);
		const meta = p.meta;
		const func = p.default;
		return {
			file: m,
			exec: func,
			meta,
			afterInit: p.afterInit,
			name: m.split(".").slice(0, -1).join("."),
		};
	});
})();
const settingsPromise = window.api.settingsProvider.getAll({}).then((x) => (window.__ytd_settings = merge({}, x)));
window.__ytd_plugins = Object.freeze(plugins);
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
				const pluginContext = { settings: new Proxy(window.__ytd_settings, {}) };
				const destroyFns = plugins.map((m) => {
					if (m.meta) log.child(`Client Plugin, ${m.meta.name}`).debug("enabled:", m.meta.enabled !== false);
					else log.child(`Client Plugin, ${m.name}`).debug(m.name, m.meta);
					if (m.meta.enabled === false) return undefined;
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
				plugins.forEach((p) => {
					if (!p.afterInit) return;
					p.afterInit(pluginContext);
					log.child(`Client Plugin, ${p.name}`).debug(`afterInit execute`);
				});
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
