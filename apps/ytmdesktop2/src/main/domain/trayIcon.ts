import { platform } from "@electron-toolkit/utils";
import { NativeImage, nativeImage } from "electron";
import { existsSync, readFileSync } from "fs";
import trayIconPng from "~/build/32x32.png?asset";
import trayIconIco from "~/build/favicon.ico?asset";

/** Prefer asar.unpacked so createFromPath works in packaged builds. */
function resolveAssetPath(assetPath: string): string {
	if (!assetPath) return assetPath;
	if (assetPath.includes("app.asar.unpacked")) return assetPath;
	if (assetPath.includes("app.asar")) return assetPath.replace("app.asar", "app.asar.unpacked");
	return assetPath;
}

function loadTrayImage(assetPath: string): NativeImage {
	const resolved = resolveAssetPath(assetPath);
	const path = existsSync(resolved) ? resolved : assetPath;
	try {
		if (existsSync(path)) {
			// Buffer load also works when the file is still inside asar.
			return nativeImage.createFromBuffer(readFileSync(path));
		}
	} catch {
		/* fall through */
	}
	return nativeImage.createFromPath(path);
}

/**
 * Tray / menu-bar icon.
 * Windows: ICO. macOS/Linux: app PNG (ICO often empty on Darwin).
 */
export function createTrayNativeImage(): NativeImage {
	if (platform.isWindows) {
		const ico = loadTrayImage(trayIconIco);
		if (!ico.isEmpty()) return ico;
	}

	const png = loadTrayImage(trayIconPng);
	if (!png.isEmpty()) {
		const size = platform.isMacOS ? 18 : 24;
		return png.resize({ width: size, height: size });
	}

	return loadTrayImage(trayIconIco);
}
