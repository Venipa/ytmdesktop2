import { createLogger } from "@shared/utils/console";
import fs from "fs";
import path from "path";
import { compileAsync, compileStringAsync } from "sass";

interface CacheEntry {
	css: string;
	mtimeMs?: number;
}

const logger = createLogger("ThemeCompiler");

export class ThemeCompiler {
	private readonly cache = new Map<string, CacheEntry>();

	clear(): void {
		this.cache.clear();
	}

	async compileString(source: string, cacheKey: string, bypassCache = false): Promise<string | null> {
		if (!bypassCache) {
			const cached = this.cache.get(cacheKey);
			if (cached) return cached.css;
		}
		try {
			const result = await compileStringAsync(source);
			this.cache.set(cacheKey, { css: result.css });
			return result.css;
		} catch (error: any) {
			logger.error(`Failed to compile string [${cacheKey}]: ${error?.message || "Unknown error"}`);
			return null;
		}
	}

	async compileFile(filePath: string, bypassCache = false): Promise<string | null> {
		try {
			if (!fs.existsSync(filePath)) {
				logger.warn(`Theme file not found: ${filePath}`);
				return null;
			}

			const ext = path.extname(filePath).toLowerCase();
			const stats = fs.statSync(filePath);
			const cacheKey = `file:${filePath}`;

			if (!bypassCache) {
				const cached = this.cache.get(cacheKey);
				if (cached && cached.mtimeMs === stats.mtimeMs) {
					return cached.css;
				}
			}

			let css: string;
			if (ext === ".css") {
				css = fs.readFileSync(filePath, "utf8");
			} else if (ext === ".scss" || ext === ".sass") {
				css = (await compileAsync(filePath)).css;
			} else {
				logger.error(`Unsupported theme file extension: ${ext}`);
				return null;
			}

			this.cache.set(cacheKey, { css, mtimeMs: stats.mtimeMs });
			return css;
		} catch (error: any) {
			logger.error(`Failed to compile file ${filePath}: ${error?.message || "Unknown error"}`);
			return null;
		}
	}
}
