import { platform } from "@electron-toolkit/utils";
import { createLogger } from "@shared/utils/console";
import { NativeImage, nativeImage } from "electron";
import { existsSync, readFileSync } from "fs";
import trayIconPng32 from "~/build/32x32.png?asset";
import trayIconIco from "~/build/favicon.ico?asset";
import trayTemplate1x from "~/build/trayTemplate.png?asset";
import trayTemplate2x from "~/build/trayTemplate-2x.png?asset";

const log = createLogger("trayIcon");

/** Load image bytes via fs — works inside asar; createFromPath often does not on macOS. */
function loadFromAsset(assetPath: string): NativeImage {
	try {
		if (!assetPath) return nativeImage.createEmpty();
		if (!existsSync(assetPath)) {
			log.warn("tray asset missing", assetPath);
			return nativeImage.createEmpty();
		}
		const buf = readFileSync(assetPath);
		const img = nativeImage.createFromBuffer(buf);
		if (img.isEmpty()) log.warn("tray asset decoded empty", assetPath);
		return img;
	} catch (err) {
		log.error("tray asset load failed", assetPath, err);
		return nativeImage.createEmpty();
	}
}

/**
 * Platform tray image for the macOS menu bar / Win+Linux notification area.
 * Prefer prebuilt black+alpha Template PNGs on Darwin; ICO on Windows.
 */
export function createTrayNativeImage(): NativeImage {
	if (platform.isWindows) {
		const ico = loadFromAsset(trayIconIco);
		if (!ico.isEmpty()) return ico;
	}

	if (platform.isMacOS) {
		const oneX = loadFromAsset(trayTemplate1x);
		const twoX = loadFromAsset(trayTemplate2x);

		if (!oneX.isEmpty()) {
			oneX.setTemplateImage(true);
			if (!twoX.isEmpty()) {
				try {
					oneX.addRepresentation({ scaleFactor: 2, buffer: twoX.toPNG() });
				} catch (err) {
					log.warn("addRepresentation @2x failed", err);
				}
			}
			oneX.setTemplateImage(true);
			return oneX;
		}

		// Fallback: color PNG (still visible without template inversion)
		const color = loadFromAsset(trayIconPng32);
		if (!color.isEmpty()) return color.resize({ width: 18, height: 18 });
	}

	const color = loadFromAsset(trayIconPng32);
	if (!color.isEmpty()) return color.resize({ width: 24, height: 24 });

	const ico = loadFromAsset(trayIconIco);
	return ico;
}
