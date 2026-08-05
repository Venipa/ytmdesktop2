import { AfterInit, BaseProvider } from "@main/core/baseProvider";
import { serverMain } from "@main/ipc/serverEvents";
import CSSHandler from "@main/lib/css/handler";
import { onMusicReload } from "@main/lifecycle";
import playerThumbnailStyle from "@main/trpc/routers/customCss/resources/basic-style/player-thumbnail-background.scss?raw";
import basicScrollStyle from "@main/trpc/routers/customCss/resources/basic-style/thumb.scss?raw";
import SettingsProvider from "@main/trpc/routers/settings/service";
import { rootWindowClearCustomCss, rootWindowInjectCustomCss } from "@main/windows/webContentUtils";
import customDefaultCss from "@renderer/assets/default-custom.scss?raw";
import type { App } from "electron";
import fs from "fs";
import { debounce } from "lodash-es";
import path from "path";
import { compileAsync } from "sass";

interface CompiledCSS {
	css: string;
	timestamp: number;
	size: number;
}

export interface CustomCssConfig {
	enabled: boolean;
	scssFile: string | null;
	watching: boolean;
	thumbnailBackground?: boolean;
}

export default class CustomCSSProvider extends BaseProvider implements AfterInit {
	private scssWatcher?: fs.FSWatcher | null;
	private cssCache: Map<string, CompiledCSS> = new Map();
	private readonly CACHE_DURATION = 30000; // 30 seconds cache duration
	private readonly DEBOUNCE_DELAY = 1000; // 1 second debounce delay
	private currentScssPath: string | null = null;
	private reapplyChain: Promise<void> = Promise.resolve();

	get settingsInstance(): SettingsProvider {
		return this.getProvider("settings");
	}
	constructor(private app: App) {
		super("customCss");
		// Preload `api.reloadCustomCss` still sends this; React uses tRPC `customCss.reload`.
		serverMain.on("customcss.update", () => void this.requestUpdate());
	}
	private getScssPath(): string {
		return this.settingsInstance.get<string | null>("customcss.scssFile") ?? path.resolve(this.app.getPath("documents"), "ytmdesktop", "custom.scss");
	}
	private clearCache() {
		this.cssCache.clear();
		this.logger.debug("CSS cache cleared");
	}
	private async compileSCSS(scssPath: string, bypassCache: boolean = false): Promise<string | null> {
		try {
			// Check if the SCSS file path has changed
			if (this.currentScssPath !== scssPath) {
				this.clearCache();
				this.currentScssPath = scssPath;
			}

			const stats = fs.statSync(scssPath);
			const cached = this.cssCache.get(scssPath);

			if (!bypassCache && cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
				this.logger.debug(`Using cached CSS: ${scssPath}`);
				return cached.css;
			}

			this.logger.debug(`Compiling SCSS${bypassCache ? " (cache bypassed)" : ""}: ${scssPath}`);
			const result = await compileAsync(scssPath);
			const compiledCSS = result.css;

			this.cssCache.set(scssPath, {
				css: compiledCSS,
				timestamp: Date.now(),
				size: new TextEncoder().encode(compiledCSS).length,
			});

			return compiledCSS;
		} catch (error: any) {
			this.logger.error(`Failed to compile SCSS: ${error?.message || "Unknown error"}`);
			return null;
		}
	}
	private async injectCompiledCSS(scssPath: string, bypassCache: boolean = false): Promise<boolean> {
		const css = await this.compileSCSS(scssPath, bypassCache);
		if (!css) return false;
		this.logger.debug(`Injecting CSS: ${this.cssCache.get(scssPath)?.size ?? 0} bytes`);

		try {
			return await rootWindowInjectCustomCss(this.views.youtubeView, css);
		} catch (error: any) {
			this.logger.error(`Failed to inject CSS: ${error?.message || "Unknown error"}`);
			return false;
		}
	}
	private setupFileWatcher(scssPath: string) {
		// Cleanup existing watcher
		if (this.scssWatcher) {
			this.scssWatcher.close();
			this.scssWatcher = null;
		}

		try {
			const debouncedUpdate = debounce(async () => {
				this.logger.debug(`SCSS file changed: ${scssPath}`);
				await this.updateCSS(true);
			}, this.DEBOUNCE_DELAY);

			// Watch the directory for changes
			const watchDir = path.dirname(scssPath);
			this.scssWatcher = fs.watch(watchDir, async (eventType, filename) => {
				if (filename === path.basename(scssPath)) {
					debouncedUpdate();
				}
			});

			this.scssWatcher.on("error", (error) => {
				this.logger.error(`File watcher error: ${error.message}`);
				this.scssWatcher = null;
			});

			this.logger.debug(`Watching SCSS file: ${scssPath}`);
		} catch (error: any) {
			this.logger.error(`Failed to setup file watcher: ${error?.message || "Unknown error"}`);
			this.scssWatcher = null;
		}
	}
	private async updateCSS(bypassCache: boolean = false) {
		const config = this.settingsInstance.get<CustomCssConfig>("customcss");
		if (!config?.enabled) return;

		const scssPath = this.getScssPath();
		if (!fs.existsSync(scssPath)) {
			this.logger.warn(`SCSS file not found: ${scssPath}`);
			return;
		}

		this.logger.debug(`Loading custom CSS from ${scssPath}${bypassCache ? " (cache bypassed)" : ""}`);
		const before = performance.now();
		await this.injectCompiledCSS(scssPath, bypassCache);
		const after = performance.now();
		this.logger.debug(`CSS injected in ${(after - before).toFixed(2)}ms`);
	}
	async requestUpdate() {
		await this.updateCSS();
	}

	private async _event_settingsChange(_key: string, value: any) {
		const config = this.settingsInstance.get<CustomCssConfig>("customcss");
		this.logger.debug(`Settings changed: ${_key}`, value);
		if (config?.enabled) {
			if (_key === "customcss.watching") {
				if (value) {
					this.setupFileWatcher(this.getScssPath());
				} else if (this.scssWatcher) {
					this.scssWatcher.close();
					this.scssWatcher = null;
				}
			} else {
				await this.updateCSS();
			}
		} else {
			await rootWindowClearCustomCss(this.views.youtubeView);
		}
	}
	private async _event_settingsChangeThumbnailBackground(_key: string, thumbnailBackgroundEnabled: boolean) {
		if (!this.thumbnailBackgroundStyle) this.thumbnailBackgroundStyle = new CSSHandler(this.windowContext.views.youtubeView.webContents, { translateSass: true });
		if (thumbnailBackgroundEnabled && !this.thumbnailBackgroundStyle.isCreated) await this.thumbnailBackgroundStyle.createOrUpdate(playerThumbnailStyle);
		else await this.thumbnailBackgroundStyle.remove().catch(() => {});
	}
	async injectCSS() {
		const scssFile = this.getScssPath();
		if (scssFile) {
			await this._initializeSCSS();
			return await this.injectCompiledCSS(scssFile);
		}
		return false;
	}
	async AfterInit() {
		this.settingsInstance.onSettingChange(
			["customcss.enabled", "customcss.scssFile", "customcss.watching"],
			(value, _prev, key) => void this._event_settingsChange(key, value),
			{ debounce: 1000 },
		);
		this.settingsInstance.onSettingChange(
			"customcss.thumbnailBackground",
			(value) => void this._event_settingsChangeThumbnailBackground("customcss.thumbnailBackground", value as boolean),
			{ debounce: 1000 },
		);
		await this._initializeSCSS();
		const config = this.settingsInstance.get<CustomCssConfig>("customcss");
		if (config?.enabled && config?.watching && config?.scssFile) {
			this.setupFileWatcher(config.scssFile);
		}
		// Inject ASAP — youtube loadURL already finished in createRootWindow;
		// do not wait for musicReload bridge (was ~5s late / easy to miss).
		await this.reapplyAllStyles();
	}
	private basicStyleHandler?: CSSHandler;
	private thumbnailBackgroundStyle?: CSSHandler;
	/** Re-inject basic + custom CSS after youtube document load/reload. */
	async reapplyAllStyles() {
		this.reapplyChain = this.reapplyChain
			.catch(() => undefined)
			.then(async () => {
				await this.basicStyleHandler?.remove().catch(() => {});
				await this.thumbnailBackgroundStyle?.remove().catch(() => {});
				this.basicStyleHandler = undefined;
				this.thumbnailBackgroundStyle = undefined;
				await this.attachBasicStyle();
				const config = this.settingsInstance.get<CustomCssConfig>("customcss");
				if (config?.enabled) await this.updateCSS();
			});
		return this.reapplyChain;
	}
	private async attachBasicStyle() {
		const youtubeView = this.windowContext.views.youtubeView.webContents;
		if (!youtubeView) {
			this.logger.error("youtubeView not found");
			return;
		}
		this.basicStyleHandler = new CSSHandler(youtubeView, { translateSass: true });
		await this.basicStyleHandler.createOrUpdate(basicScrollStyle);

		this.thumbnailBackgroundStyle = new CSSHandler(youtubeView, { translateSass: true });
		const thumbnailBackgroundEnabled = this.settingsInstance.instance.customcss?.thumbnailBackground ?? true;
		if (thumbnailBackgroundEnabled) await this.thumbnailBackgroundStyle.createOrUpdate(playerThumbnailStyle);

		this.logger.debug("basicStyleContent", { thumbnail: playerThumbnailStyle, basic: basicScrollStyle });
	}
	private async _initializeSCSS() {
		const scssPath = this.getScssPath();
		const scssParent = path.resolve(scssPath, "..");

		try {
			if (!fs.existsSync(scssPath)) {
				if (!fs.existsSync(scssParent)) {
					fs.mkdirSync(scssParent, { recursive: true });
				}

				fs.writeFileSync(scssPath, customDefaultCss);
				this.logger.debug(`Created default SCSS file at ${scssPath}`);

				// Update settings after creating the file
				this.settingsInstance.set("customcss.enabled", true).set("customcss.scssFile", scssPath);

				// Setup file watching if enabled
				const config = this.settingsInstance.get<CustomCssConfig>("customcss");
				if (config?.watching) {
					this.setupFileWatcher(scssPath);
					this.logger.debug("Setup file watcher", scssPath);
				}

				return true;
			} else {
				this.logger.debug(`SCSS file already exists: ${scssPath}`);
				if (!this.settingsInstance.get("customcss.scssFile")) {
					this.settingsInstance.set("customcss.scssFile", scssPath);
				}
			}
			return false;
		} catch (error: any) {
			this.logger.error(`Failed to initialize SCSS: ${error?.message || "Unknown error"}`);
			return false;
		}
	}
	readonly initializeSCSS = () => this._initializeSCSS();
}

onMusicReload(async (ctx) => {
	const customCss = ctx.getProvider("customCss") as CustomCSSProvider | undefined;
	if (customCss) await customCss.reapplyAllStyles();
});
