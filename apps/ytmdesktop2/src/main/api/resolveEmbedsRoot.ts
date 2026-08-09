import { isDevelopment } from "@main/infra/devUtils";
import { createLogger } from "@shared/utils/console";
import { app } from "electron";
import fs from "node:fs";
import path from "node:path";

const log = createLogger("api-embeds");

function withUnpackedTwin(dir: string): string[] {
	if (dir.includes("app.asar") && !dir.includes("app.asar.unpacked")) {
		return [dir.replace("app.asar", "app.asar.unpacked"), dir];
	}
	return [dir];
}

/**
 * Resolve built embed assets root (`…/now-playing/index.html` lives under this).
 * Dev + prod: `resources/embeds` (built by electron-vite sidecar plugin).
 * Packaged builds unpack `resources/**` -> prefer `app.asar.unpacked`.
 */
export function resolveEmbedsRoot(): string | null {
	const candidates: string[] = [];
	const push = (dir: string | null | undefined) => {
		if (!dir) return;
		for (const next of withUnpackedTwin(dir)) {
			if (!candidates.includes(next)) candidates.push(next);
		}
	};

	// electron-vite out/main → ../../resources/embeds
	push(path.resolve(__dirname, "../../resources/embeds"));
	push(path.resolve(__dirname, "../resources/embeds"));

	// Always allow cwd (preview / monorepo / pack-from-artifact)
	push(path.resolve(process.cwd(), "resources/embeds"));
	push(path.resolve(process.cwd(), "apps/ytmdesktop2/resources/embeds"));

	try {
		push(path.join(process.resourcesPath, "app.asar.unpacked", "resources", "embeds"));
		push(path.join(app.getAppPath(), "resources", "embeds"));
		if (app.isPackaged) {
			push(path.join(process.resourcesPath, "resources", "embeds"));
		}
	} catch {
		/* app may be unavailable in tests */
	}

	if (isDevelopment) {
		log.debug("embeds candidates", candidates);
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
