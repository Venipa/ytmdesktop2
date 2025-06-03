import fs from "fs";
import path, { basename } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { stringifyJson } from "@main/lib/json";
import { EXAMPLE_PLUGINS_CONTENT } from "@main/lib/raw/plugins/example";
import { EXAMPLE_PLUGINS_README } from "@main/lib/raw/plugins/readme";
import { createLogger } from "@shared/utils/console";
import { app } from "electron";
import { valid as validateVersion } from "semver";
import { z } from "zod";
import { IpcHandle } from "./onIpcEvent";

const log = createLogger("PluginManager");

const pluginMetaSchema = z.object({
	name: z.string().transform((val) => val.replace(/<[^>]*>/g, "")),
	description: z
		.string()
		.optional()
		.default("")
		.transform((val) => val.replace(/<[^>]*>/g, "")),
	author: z.string().transform((val) => val.replace(/<[^>]*>/g, "")),
	version: z
		.string()
		.optional()
		.default("1.0.0")
		.refine((val) => validateVersion(val), {
			message: "Version must be a valid semantic version",
		}),
	enabled: z.boolean().optional().default(false),
});
// Helper function to sanitize JavaScript code
function sanitizeJavaScript(code: string): string {
	// Remove any HTML-like content
	code = code.replace(/<[^>]*>/g, "");

	// Remove potentially dangerous eval-like functions
	const dangerousPatterns = [
		/eval\s*\(/i,
		/Function\s*\(/i,
		/setTimeout\s*\(/i,
		/setInterval\s*\(/i,
		/new\s+Function\s*\(/i,
		/document\.write\s*\(/i,
		/document\.writeln\s*\(/i,
		/innerHTML\s*=/i,
		/outerHTML\s*=/i,
		/insertAdjacentHTML\s*\(/i,
	];

	for (const pattern of dangerousPatterns) {
		if (pattern.test(code)) {
			log.warn(`Plugin contains potentially dangerous code: ${pattern}`);
		}
	}

	return code;
}

// Helper function to validate plugin metadata
function validatePluginMeta(meta: any): boolean {
	const result = pluginMetaSchema.safeParse(meta);
	if (!result.success) {
		log.error(`Invalid plugin metadata: ${result.error}`);
		return false;
	}

	return true;
}

export interface ClientPluginMeta {
	name: string;
	enabled?: boolean;
	description?: string;
	author?: string;
	version?: string;
}

export interface ClientPluginSerialized {
	name: string;
	meta: ClientPluginMeta;
	filepath: string;
	enabled: boolean;
	type: "user" | "system";
}

export class PluginInstance {
	private readonly _name: string;
	private readonly _file: string;
	private readonly _exec: Function;
	private readonly _meta: ClientPluginMeta;
	private readonly _afterInit?: Function;
	private _isEnabled: boolean;
	private readonly _type: "user" | "system";
	constructor(name: string, file: string, exec: Function, meta: ClientPluginMeta, afterInit?: Function, type: "user" | "system" = "system") {
		this._name = name;
		this._file = file;
		this._exec = exec;
		this._meta = meta;
		this._afterInit = afterInit;
		this._isEnabled = meta.enabled !== false;
		this._type = type;
	}

	get name(): string {
		return this._name;
	}

	get file(): string {
		return this._file;
	}

	get meta(): ClientPluginMeta {
		return this._meta;
	}

	get isEnabled(): boolean {
		return this._isEnabled;
	}

	set isEnabled(value: boolean) {
		this._isEnabled = value;
		this._meta.enabled = value;
	}

	execute(context: any): Function | undefined {
		if (!this._isEnabled) return undefined;
		return this._exec?.(context);
	}

	afterInit(context: any): void {
		if (!this._isEnabled || !this._afterInit) return;
		this._afterInit(context);
	}

	serialize(): ClientPluginSerialized {
		return {
			name: this._name,
			meta: this._meta,
			filepath: this._file,
			enabled: this._isEnabled,
			type: this._type,
		};
	}

	static fromModule(url: string, module: any, type: "user" | "system"): PluginInstance {
		const name = basename(fileURLToPath(url));
		return new PluginInstance(name, url, module.default, module.meta, module.afterInit, type);
	}
}

export class PluginManager {
	private userDataPluginsDir: string;
	private userPluginsDir: string;
	private _loadedPlugins: PluginInstance[] = [];
	private _isLoaded = false;
	get isLoaded() {
		return this._isLoaded;
	}
	get loadedPlugins() {
		return this._loadedPlugins;
	}

	constructor() {
		this.userDataPluginsDir = path.join(app.getPath("userData"), "plugins");
		this.userPluginsDir = path.join(app.getPath("documents"), "ytmdesktop", "plugins");
		this.ensurePluginsDirectories();
	}
	private newlyCreatedExamplePlugin = false;
	private ensurePluginsDirectories() {
		// Ensure userData plugins directory exists
		if (!fs.existsSync(this.userDataPluginsDir)) {
			fs.mkdirSync(this.userDataPluginsDir, { recursive: true });
		}

		// Ensure user plugins directory exists
		if (!fs.existsSync(this.userPluginsDir)) {
			fs.mkdirSync(this.userPluginsDir, { recursive: true });
			// Create example plugin and README
			this.createExamplePlugin();
		}
	}

	private createExamplePlugin() {
		const examplePluginPath = path.join(this.userPluginsDir, "example.plugin.mjs");
		const readmePath = path.join(this.userPluginsDir, "README.md");

		fs.writeFileSync(examplePluginPath, EXAMPLE_PLUGINS_CONTENT);
		fs.writeFileSync(readmePath, EXAMPLE_PLUGINS_README);
		log.debug("Created example plugin and README in user plugins directory");
	}

	public ensurePluginsLoaded() {
		if (!this._isLoaded) {
			return this.loadPlugins();
		}
		return Promise.resolve(this._loadedPlugins);
	}

	public async extractPlugins(pluginFiles: Record<string, any>) {
		for (const [filename, plugin] of Object.entries(pluginFiles)) {
			try {
				const pluginName = path.basename(filename);
				const targetPath = path.join(this.userDataPluginsDir, pluginName);
				console.log("plugin", stringifyJson(plugin));
				// Validate and sanitize plugin metadata
				if (!validatePluginMeta(plugin.meta)) {
					log.error(`Invalid plugin metadata in ${pluginName}`);
					continue;
				}

				// Sanitize plugin code
				const defaultFunc = plugin.handler?.toString() || "() => {}";
				const afterInitFunc = plugin.afterInit?.toString() || "() => {}";

				const sanitizedDefaultFunc = sanitizeJavaScript(defaultFunc);
				const sanitizedAfterInitFunc = sanitizeJavaScript(afterInitFunc);

				// Write the sanitized plugin file
				const pluginContent = `module.exports = {
					meta: ${JSON.stringify(plugin.meta)},
					afterInit: ${sanitizedAfterInitFunc},
					handler: ${sanitizedDefaultFunc},
				};`;

				fs.writeFileSync(targetPath, pluginContent);
				log.debug(`Extracted plugin: ${pluginName}`);
			} catch (error) {
				log.error(`Failed to extract plugin ${filename}:`, error);
				throw error; // Re-throw to handle it in the caller
			}
		}
	}

	@IpcHandle("pluginManager.loadPlugins")
	public async loadPlugins(): Promise<PluginInstance[]> {
		if (this._isLoaded) {
			return this._loadedPlugins;
		}
		const plugins: PluginInstance[] = [];

		// Load plugins from both directories
		const loadPluginsFromDir = async (dir: string, type: "user" | "system") => {
			if (!fs.existsSync(dir)) return;

			const files = fs.readdirSync(dir);
			for (const file of files) {
				if (!file.endsWith(".plugin.mjs")) continue;

				try {
					const pluginPath = path.join(dir, file);
					const pluginUrl = pathToFileURL(pluginPath).toString();
					const pluginMeta = await eval(`(function() { return import('${pluginUrl}').then(s => s && s.meta) })()`);
					console.log("pluginMeta", pluginMeta);
					if (!pluginMeta) {
						log.error(`No meta export found in ${pluginPath}`);
						continue;
					}
					if (!validatePluginMeta(pluginMeta)) {
						log.error(`Invalid plugin metadata in ${pluginPath}`);
						continue;
					}
					// Validate plugin metadata
					if (!validatePluginMeta(pluginMeta)) {
						throw new Error(`Invalid plugin metadata in ${file}`);
					}
					log.debug("Loading plugin:", { file });

					const plugin = PluginInstance.fromModule(pluginUrl, { meta: pluginMeta }, type);
					plugins.push(plugin);
					log.debug(`Loaded plugin: ${file} from ${dir}`);
				} catch (error) {
					log.error(`Failed to load plugin ${file} from ${dir}:`, error);
				}
			}
		};

		await Promise.all([loadPluginsFromDir(this.userDataPluginsDir, "system"), loadPluginsFromDir(this.userPluginsDir, "user")]);

		this._loadedPlugins = plugins;
		this._isLoaded = true;
		log.debug("Loaded plugins:\n" + plugins.map((p) => p.name).join(", ") + "\n");

		return plugins;
	}
}
