import { platform } from "@electron-toolkit/utils";
import { NativeImage, nativeImage } from "electron";
import trayIconPng16 from "~/build/16x16.png?asset";
import trayIconPng32 from "~/build/32x32.png?asset";
import trayIconIco from "~/build/favicon.ico?asset";

/**
 * Convert a color logo (dark bg + light mark) into a macOS template image:
 * black pixels + alpha derived from luminance so the menu bar can invert it.
 */
function toMenuBarTemplate(source: NativeImage): NativeImage {
	const { width, height } = source.getSize();
	if (width <= 0 || height <= 0 || source.isEmpty()) return source;

	const src = source.toBitmap();
	const out = Buffer.alloc(src.length);
	for (let i = 0; i < src.length; i += 4) {
		const b = src[i]!;
		const g = src[i + 1]!;
		const r = src[i + 2]!;
		const a = src[i + 3]!;
		const lum = (r + g + b) / 3;
		// Near-black canvas → transparent; mark → black with luminance alpha.
		const alpha = lum < 24 ? 0 : Math.min(255, Math.round(lum * (a / 255)));
		out[i] = 0;
		out[i + 1] = 0;
		out[i + 2] = 0;
		out[i + 3] = alpha;
	}

	const img = nativeImage.createFromBitmap(out, { width, height });
	img.setTemplateImage(true);
	return img;
}

/**
 * Platform tray image. Windows prefers ICO; macOS/Linux need PNG
 * (ICO often yields an empty NativeImage on Darwin → invisible tray).
 */
export function createTrayNativeImage(): NativeImage {
	if (platform.isWindows) {
		const ico = nativeImage.createFromPath(trayIconIco);
		if (!ico.isEmpty()) return ico;
	}

	const png32 = nativeImage.createFromPath(trayIconPng32);
	const png16 = nativeImage.createFromPath(trayIconPng16);
	const base = !png32.isEmpty() ? png32 : png16;

	if (base.isEmpty()) {
		const fallback = nativeImage.createFromPath(trayIconIco);
		return fallback;
	}

	if (platform.isMacOS) {
		const oneX = toMenuBarTemplate((!png16.isEmpty() ? png16 : base).resize({ width: 16, height: 16 }));
		const twoXSource = !png32.isEmpty() ? png32 : base;
		const twoX = toMenuBarTemplate(twoXSource.resize({ width: 32, height: 32 }));
		oneX.addRepresentation({ scaleFactor: 2, buffer: twoX.toPNG() });
		oneX.setTemplateImage(true);
		return oneX;
	}

	// Linux / other — colored PNG at menu-bar size.
	return base.resize({ width: 24, height: 24 });
}
