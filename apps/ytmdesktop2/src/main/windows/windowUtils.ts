import { platform } from "@electron-toolkit/utils";
import { lockAppChromeZoom } from "@main/domain/uiZoom";
import { isDevelopment, isProdDebug } from "@main/infra/devUtils";
import { createYmlStore } from "@main/lib/store/createYmlStore";
import { attachTrpcWindow } from "@main/trpc/handler";
import { createLogger } from "@shared/utils/console";
import { BrowserWindow, screen, shell, WebContentsView } from "electron";
import { join } from "path";
import appIconPath from "~/build/favicon.ico?asset";
import { registerWindowDialogResponse } from "./dialogResponse";
import { loadUrlOfWindow, syncWindowStateToWebContents } from "./webContentUtils";

export type WindowOptions = {
	path: string;
	parent: BrowserWindow;
	minHeight?: number;
	minWidth?: number;
	maxHeight?: number;
	maxWidth?: number;
	height?: number;
	width?: number;
	top?: boolean;
	showTaskBar?: boolean;
	maximizeable?: boolean;
	minimizeable?: boolean;
	show?: boolean;
	/** Electron BrowserWindow `type` (e.g. macOS `panel` for tray popups). */
	type?: Electron.BrowserWindowConstructorOptions["type"];
	/** Open detached DevTools (defaults to true in development). */
	devtools?: boolean;
};
const log = createLogger("main");
export function parseScriptPath(p: string) {
	log.child("parseScriptPath").debug(__dirname, p);
	return join(__dirname, "../preload", p);
}
/** Center child over parent bounds (works across multi-monitor). */
export function centerWindowOnParent(win: BrowserWindow, parent?: BrowserWindow | null) {
	if (!win || win.isDestroyed() || !parent || parent.isDestroyed()) return;
	const parentBounds = parent.getBounds();
	const { width, height } = win.getBounds();
	const x = Math.round(parentBounds.x + (parentBounds.width - width) / 2);
	const y = Math.round(parentBounds.y + (parentBounds.height - height) / 2);
	win.setPosition(x, y);
}

export type WindowShortcutBinding = {
	/** Remove listener; safe to call multiple times. */
	destroy: () => void;
	/** Alias of `destroy`. */
	unsubscribe: () => void;
};

export type WindowShortcutOptions = {
	/** Only match keyDown / rawKeyDown (default true). */
	keyDownOnly?: boolean;
	/** Call `event.preventDefault()` when matched (default true). */
	preventDefault?: boolean;
};

type ParsedWindowShortcut = {
	ctrl: boolean;
	meta: boolean;
	alt: boolean;
	shift: boolean;
	/** Normalized key token (lowercased unless special name). */
	key: string;
};

const SPECIAL_KEY_ALIASES: Record<string, string> = {
	esc: "escape",
	escape: "escape",
	return: "enter",
	enter: "enter",
	space: " ",
	spacebar: " ",
	up: "arrowup",
	down: "arrowdown",
	left: "arrowleft",
	right: "arrowright",
	arrowup: "arrowup",
	arrowdown: "arrowdown",
	arrowleft: "arrowleft",
	arrowright: "arrowright",
	del: "delete",
	delete: "delete",
	backspace: "backspace",
	tab: "tab",
	plus: "+",
	minus: "-",
	equal: "=",
	equals: "=",
};

function normalizeShortcutKey(raw: string): string {
	const token = raw.trim().toLowerCase();
	if (!token) return "";
	if (SPECIAL_KEY_ALIASES[token]) return SPECIAL_KEY_ALIASES[token];
	if (/^f\d{1,2}$/.test(token)) return token;
	if (token.length === 1) return token;
	return token;
}

/**
 * Parse accelerator-style shortcut: `"Escape"`, `"Ctrl+S"`, `"CmdOrCtrl+Shift+K"`.
 * QA: Electron `input.key` is KeyboardEvent-like; letter case / Numpad vs Digit can differ —
 * matcher compares lowercased key and accepts common aliases, not full Electron accelerator grammar.
 */
function parseWindowShortcut(shortcut: string): ParsedWindowShortcut | null {
	const parts = shortcut
		.split("+")
		.map((p) => p.trim())
		.filter(Boolean);
	if (!parts.length) return null;

	let ctrl = false;
	let meta = false;
	let alt = false;
	let shift = false;
	let key = "";

	for (const part of parts) {
		const lower = part.toLowerCase();
		if (lower === "ctrl" || lower === "control") {
			ctrl = true;
			continue;
		}
		if (lower === "cmd" || lower === "command" || lower === "meta" || lower === "super") {
			meta = true;
			continue;
		}
		if (lower === "cmdorctrl" || lower === "commandorcontrol") {
			if (platform.isMacOS) meta = true;
			else ctrl = true;
			continue;
		}
		if (lower === "alt" || lower === "option") {
			alt = true;
			continue;
		}
		if (lower === "shift") {
			shift = true;
			continue;
		}
		if (key) {
			log.child("shortcutOnWindow").warn("multiple key tokens in shortcut, using last", shortcut);
		}
		key = normalizeShortcutKey(part);
	}

	if (!key) return null;
	return { ctrl, meta, alt, shift, key };
}

function matchesWindowShortcut(input: Electron.Input, parsed: ParsedWindowShortcut): boolean {
	if (!!input.control !== parsed.ctrl) return false;
	if (!!input.meta !== parsed.meta) return false;
	if (!!input.alt !== parsed.alt) return false;
	if (!!input.shift !== parsed.shift) return false;

	const inputKey = normalizeShortcutKey(input.key ?? "");
	if (inputKey && inputKey === parsed.key) return true;

	// Fallback: some Electron builds expose layout code (e.g. Digit1) more reliably than key.
	const inputCode = (input.code ?? "").toLowerCase();
	if (!inputCode) return false;
	if (parsed.key.length === 1) {
		if (inputCode === `key${parsed.key}`) return true;
		if (inputCode === `digit${parsed.key}`) return true;
		if (inputCode === `numpad${parsed.key}`) return true;
	}
	if (parsed.key === "+" && (inputCode === "equal" || inputCode === "numpadadd")) return true;
	if (parsed.key === "-" && (inputCode === "minus" || inputCode === "numpadsubtract")) return true;
	if (parsed.key.startsWith("f") && inputCode === parsed.key) return true;
	return false;
}

function isUsableWindow(win: BrowserWindow | WebContentsView | null | undefined): win is BrowserWindow | WebContentsView {
	if (!win) return false;
	try {
		// BrowserWindow has isDestroyed(); WebContentsView — check webContents only.
		if (win instanceof BrowserWindow && win.isDestroyed()) return false;
		const wc = win.webContents;
		if (!wc || wc.isDestroyed()) return false;
		return true;
	} catch {
		return false;
	}
}

/**
 * Bind keyboard shortcut(s) on a window/view via `before-input-event`.
 * Returns destroy/unsubscribe handle; auto-cleans on window/webContents destroy.
 *
 * Potential fixes / QA:
 * - Prefer same binding instance for off — never recreate listener inline (old bug).
 * - Guard destroyed windows before on/off (Electron throws if WC gone).
 * - Match keyDown only by default so keyUp does not double-fire callbacks.
 * - Modifiers must match exactly (Ctrl+S ≠ S); use `CmdOrCtrl` for cross-platform.
 * - Not global: only fires while this webContents focused (use `globalShortcut` for OS-wide).
 */
export function shortcutOnWindow(
	win: BrowserWindow | WebContentsView | null | undefined,
	shortcut: string | readonly string[],
	callback: (input: Electron.Input) => void,
	options: WindowShortcutOptions = {},
): WindowShortcutBinding | null {
	if (!isUsableWindow(win)) {
		log.child("shortcutOnWindow").warn("window missing or destroyed, skip bind");
		return null;
	}

	const shortcutList = (typeof shortcut === "string" ? [shortcut] : [...shortcut])
		.map(parseWindowShortcut)
		.filter((s): s is ParsedWindowShortcut => !!s);

	if (!shortcutList.length) {
		log.child("shortcutOnWindow").warn("no valid shortcuts to bind", shortcut);
		return null;
	}

	const keyDownOnly = options.keyDownOnly !== false;
	const preventDefault = options.preventDefault !== false;
	let destroyed = false;

	const onInput = (event: Electron.Event, input: Electron.Input) => {
		if (destroyed) return;
		if (keyDownOnly && input.type !== "keyDown" && input.type !== "rawKeyDown") return;
		if (!shortcutList.some((s) => matchesWindowShortcut(input, s))) return;
		if (preventDefault) event.preventDefault();
		try {
			callback(input);
		} catch (error) {
			log.child("shortcutOnWindow").error("shortcut callback failed", error);
		}
	};

	const destroy = () => {
		if (destroyed) return;
		destroyed = true;
		try {
			if (isUsableWindow(win)) {
				win.webContents.removeListener("before-input-event", onInput);
			}
		} catch {
			/* already gone */
		}
	};

	win.webContents.on("before-input-event", onInput);
	win.webContents.once("destroyed", destroy);
	if (win instanceof BrowserWindow) {
		win.once("closed", destroy);
	}

	return { destroy, unsubscribe: destroy };
}

export async function createAppWindow(appOptions?: Partial<WindowOptions>) {
	// eslint-disable-next-line prefer-const
	let { parent, path, minHeight, minWidth, maxHeight, maxWidth, height, width, top, showTaskBar, minimizeable, maximizeable, show, type, devtools } =
		appOptions ?? {};
	if (!path) path = "/";
	const shouldShow = show ?? true;
	const shouldOpenDevtools = devtools ?? (isDevelopment || isProdDebug);
	// Create hidden so we can position relative to parent before first paint (avoids primary-display flash).
	const win = new BrowserWindow({
		width: width ?? 800,
		height: height ?? 600,
		minWidth: minWidth ?? 800,
		minHeight: minHeight ?? 480,
		maxWidth,
		maxHeight,
		show: false,
		minimizable: minimizeable === true,
		maximizable: maximizeable === true,
		backgroundColor: "#000000",
		fullscreenable: !maxWidth && !maxHeight,
		icon: appIconPath,
		frame: false,
		parent,
		modal: parent && top === true,
		skipTaskbar: showTaskBar === false,
		darkTheme: true,
		...(type ? { type } : {}),
		webPreferences: {
			// Use pluginOptions.nodeIntegration, leave this alone
			// See nklayman.github.io/vue-cli-plugin-electron-builder/guide/security.html#node-integration for more info
			nodeIntegration: import.meta.env.ELECTRON_NODE_INTEGRATION === "true",
			contextIsolation: true,
			sandbox: false,
			preload: join(__dirname, "../preload/api.js"),
		},
	});

	await loadUrlOfWindow(win, path);
	lockAppChromeZoom(win.webContents);
	if (shouldOpenDevtools) win.webContents.openDevTools({ mode: "detach" });
	win.webContents.setWindowOpenHandler(({ url }) => {
		if (url.startsWith("http")) {
			shell.openExternal(url);
		}
		return { action: "deny" };
	});
	syncWindowStateToWebContents(win)(win.webContents);
	attachTrpcWindow(win);
	if (parent) centerWindowOnParent(win, parent);
	if (shouldShow) {
		win.show();
		win.moveTop();
	}
	return win;
}
export async function createAppDialogWindow<Action extends string = "close" | "ok">(
	appOptions?: Partial<WindowOptions> & { onResponse?: (action: Action) => void },
) {
	const win = await createAppWindow(appOptions);
	const onResponse = appOptions?.onResponse;
	if (onResponse) {
		const unregister = registerWindowDialogResponse(win.webContents.id, (action) => onResponse(action as Action));
		win.on("closed", unregister);
	}
	win.webContents.on("ipc-message", (ev, channel, data) => {
		if (channel === "window.response" && typeof data === "object" && typeof data.action === "string") {
			ev.reply("window.response", "ok");
			onResponse?.(data.action as Action);
		}
	});
	return win;
}
function getScaleFactor(win: BrowserWindow) {
	if (!platform.isWindows) {
		return 1;
	}
	const [x, y] = win.getPosition();
	const currentDisplay = screen.getDisplayNearestPoint({ x, y });
	return currentDisplay.scaleFactor;
}
function calculateSizeWithScaleFactor(x: number, y: number, width: number, height: number) {
	const currentDisplay = screen.getDisplayNearestPoint({ x, y });
	const scaleFactor = platform.isWindows ? currentDisplay.scaleFactor : 1;
	if (scaleFactor === 1) return { width, height, scaleFactor };
	return {
		width: width / scaleFactor,
		height: height / scaleFactor,
		scaleFactor,
	};
}
function getSizeOfWindowNative(win: BrowserWindow) {
	const { width, height } = win.getBounds();
	return {
		width,
		height,
	};
}
function getSizeOfWindow(win: BrowserWindow) {
	const { width, height, x, y } = win.getBounds();
	return calculateSizeWithScaleFactor(x, y, width, height);
}
function getDisplayNearestPoint(win: BrowserWindow) {
	const [x, y] = win.getPosition();
	const { bounds } = screen.getDisplayNearestPoint({ x, y });
	return bounds;
}
function getNearestDisplay(win: BrowserWindow) {
	const [x, y] = win.getPosition();
	return screen.getDisplayNearestPoint({ x, y });
}
export function getBoundsWithScaleFactor(win: BrowserWindow) {
	const { width, height, x, y } = win.getBounds();
	const { width: dWidth, height: dHeight, scaleFactor } = calculateSizeWithScaleFactor(x, y, width, height);
	return { x, y, width: dWidth, height: dHeight, scaleFactor };
}
export async function wrapWindowHandler(
	win: BrowserWindow,
	windowName: string,
	{
		width: defaultWidth,
		height: defaultHeight,
		persist,
	}: { width: number; height: number; persist?: () => boolean },
) {
	const key = "window-state";
	const name = `window-state-${windowName}`;
	const store = createYmlStore(name);
	const defaultSize = {
		width: defaultWidth,
		height: defaultHeight,
	};
	let state: { width: number; height: number; x: number; y: number; maximized?: boolean } | null = null;
	const restore = () => store.get(key, defaultSize);
	const raw = restore();
	const restored = typeof raw?.x === "number" && typeof raw?.y === "number";

	const getCurrentPosition = () => {
		const [x, y] = win.getPosition();
		const { width, height } = getSizeOfWindowNative(win);
		return {
			x,
			y,
			width,
			height,
			maximized: win.isMaximized(),
		};
	};

	const windowWithinBounds = (windowState, bounds) => {
		return (
			windowState.x >= bounds.x &&
			windowState.y >= bounds.y &&
			windowState.x + windowState.width <= bounds.x + bounds.width &&
			windowState.y + windowState.height <= bounds.y + bounds.height
		);
	};

	const resetToDefaults = () => {
		const bounds = win.getBounds();
		const { width, height } = getSizeOfWindowNative(win);
		return Object.assign(
			{},
			{
				x: (bounds.width - width) / 2,
				y: (bounds.height - height) / 2,
				width,
				height,
			},
		);
	};

	const ensureVisibleOnSomeDisplay = (windowState) => {
		const visible = screen.getAllDisplays().some((display) => {
			return windowWithinBounds(windowState, display.bounds);
		});
		if (!visible) {
			// Window is partially or fully not visible now.
			// Reset it to safe defaults.
			return resetToDefaults();
		}
		return windowState;
	};
	const saveState = () => {
		if (win.isDestroyed()) return;
		if (persist && !persist()) return;
		if (!win.isMinimized() && !win.isMaximized()) {
			state = Object.assign({}, state, getCurrentPosition());
		}
		store.set(key, state);
		log.debug("saveWindowState", state);
	};
	state = ensureVisibleOnSomeDisplay(raw);

	// Electron getBounds/setBounds use DIP already — do not divide by display.scaleFactor
	// (that shrunk windows on Windows 125%/150% HiDPI).
	log.debug("restoreWindowState", state, {
		displayScaleFactor: platform.isWindows && state ? screen.getDisplayNearestPoint({ x: state.x, y: state.y }).scaleFactor : 1,
	});
	win.on("close", saveState);
	return { state, saveState, restored };
}
export async function onWindowLoad(
	win: WebContentsView | BrowserWindow,
	callback: () => void | Promise<void>,
	options: { once?: boolean } = { once: false },
): Promise<void> {
	if (!win.webContents.isLoading()) {
		await callback();
		return;
	}
	if (options.once) {
		await new Promise<void>((resolve) => {
			win.webContents.once("did-finish-load", () => resolve());
		});
		await callback();
		return;
	}
	win.webContents.on("did-finish-load", () => void callback());
}

export { appIconPath };
