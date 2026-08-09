import { isDevelopment } from "@main/infra/devUtils";
import { createLogger } from "@shared/utils/console";
import { app } from "electron";
import fs from "node:fs";
import path from "node:path";

const log = createLogger("api-embeds");

/**
 * Resolve built embed assets root (`…/now-playing/index.html` lives under this).
 * Dev + prod: `resources/embeds` (Vite build via `pnpm embeds:build`).
 */
export function resolveEmbedsRoot(): string | null {
	const candidates: string[] = [];

	// electron-vite out/main → ../../resources/embeds
	candidates.push(path.resolve(__dirname, "../../resources/embeds"));
	candidates.push(path.resolve(__dirname, "../resources/embeds"));

	if (isDevelopment) {
		// Running from apps/ytmdesktop2 cwd or monorepo root
		candidates.push(path.resolve(process.cwd(), "resources/embeds"));
		candidates.push(path.resolve(process.cwd(), "apps/ytmdesktop2/resources/embeds"));
	}

	try {
		candidates.push(path.join(process.resourcesPath, "app.asar.unpacked", "resources", "embeds"));
		candidates.push(path.join(app.getAppPath(), "resources", "embeds"));
	} catch {
		/* app may be unavailable in tests */
	}

	for (const dir of candidates) {
		const indexHtml = path.join(dir, "now-playing", "index.html");
		if (fs.existsSync(indexHtml)) {
			log.debug("embeds root", dir);
			return dir;
		}
	}

	log.warn("embeds dist not found — /embed/* will return 503");
	return null;
}
