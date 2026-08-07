import { BrowserWindow, screen, Tray } from "electron";

export interface TrayPopupSize {
	width: number;
	height: number;
}

function isEmptyTrayBounds(bounds: Electron.Rectangle): boolean {
	return bounds.width <= 0 && bounds.height <= 0;
}

/**
 * Position a popup near the tray icon, clamped to the nearest display workArea.
 * Prefers above the icon when the tray sits in the lower half (Windows taskbar),
 * otherwise below (macOS menu bar). Falls back to cursor when getBounds() is empty (some Linux DEs).
 */
export function positionNearTray(win: BrowserWindow, tray: Tray, size: TrayPopupSize): void {
	if (!win || win.isDestroyed() || !tray || tray.isDestroyed()) return;

	const { width, height } = size;
	const trayBounds = tray.getBounds();
	let anchorX: number;
	let anchorY: number;
	let trayW: number;
	let trayH: number;

	if (isEmptyTrayBounds(trayBounds)) {
		const cursor = screen.getCursorScreenPoint();
		anchorX = cursor.x;
		anchorY = cursor.y;
		trayW = 0;
		trayH = 0;
	} else {
		anchorX = trayBounds.x;
		anchorY = trayBounds.y;
		trayW = trayBounds.width;
		trayH = trayBounds.height;
	}

	const display = screen.getDisplayNearestPoint({ x: anchorX, y: anchorY });
	const { workArea } = display;

	let x = Math.round(anchorX + trayW / 2 - width / 2);
	const trayCenterY = anchorY + trayH / 2;
	const preferAbove = trayCenterY > workArea.y + workArea.height / 2;

	let y: number;
	if (preferAbove) {
		y = Math.round(anchorY - height - 4);
		if (y < workArea.y) y = Math.round(anchorY + trayH + 4);
	} else {
		y = Math.round(anchorY + trayH + 4);
		if (y + height > workArea.y + workArea.height) y = Math.round(anchorY - height - 4);
	}

	x = Math.min(Math.max(x, workArea.x), workArea.x + workArea.width - width);
	y = Math.min(Math.max(y, workArea.y), workArea.y + workArea.height - height);

	win.setBounds({ x, y, width, height });
}
