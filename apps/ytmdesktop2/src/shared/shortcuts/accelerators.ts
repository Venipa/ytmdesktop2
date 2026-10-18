export type ShortcutPlatform = "darwin" | "win32" | "linux";

export type ParsedAccelerator = {
	ctrl: boolean;
	alt: boolean;
	shift: boolean;
	meta: boolean;
	cmdOrCtrl: boolean;
	key: string;
};

const MOD_TOKENS: Record<string, keyof Pick<ParsedAccelerator, "ctrl" | "alt" | "shift" | "meta" | "cmdOrCtrl">> = {
	control: "ctrl",
	ctrl: "ctrl",
	alt: "alt",
	option: "alt",
	shift: "shift",
	super: "meta",
	meta: "meta",
	win: "meta",
	windows: "meta",
	cmd: "meta",
	command: "meta",
	cmdorctrl: "cmdOrCtrl",
	commandorcontrol: "cmdOrCtrl",
};

const KEY_ALIASES: Record<string, string> = {
	esc: "Escape",
	escape: "Escape",
	return: "Enter",
	enter: "Enter",
	space: "Space",
	" ": "Space",
	arrowleft: "Left",
	arrowright: "Right",
	arrowup: "Up",
	arrowdown: "Down",
	left: "Left",
	right: "Right",
	up: "Up",
	down: "Down",
	plus: "Plus",
	add: "Plus",
	subtract: "Minus",
	minus: "-",
	tab: "Tab",
	backspace: "Backspace",
	delete: "Delete",
	del: "Delete",
	home: "Home",
	end: "End",
	pageup: "PageUp",
	pagedown: "PageDown",
	insert: "Insert",
};

const BLOCKED_KEYS = new Set([
	"mediaplaypause",
	"mediaplay",
	"mediastop",
	"mediapause",
	"medianexttrack",
	"mediaprevioustrack",
	"volumeup",
	"volumedown",
	"volumemute",
]);

function canonicalKey(raw: string): string {
	const token = raw.trim();
	if (!token) return "";
	const lower = token.toLowerCase();
	if (KEY_ALIASES[lower]) return KEY_ALIASES[lower];
	if (/^f([1-9]|1[0-9]|2[0-4])$/.test(lower)) return lower.toUpperCase();
	if (token.length === 1) return token.toUpperCase();
	return token[0].toUpperCase() + token.slice(1);
}

export function parseAccelerator(raw: string): ParsedAccelerator | null {
	const parts = raw
		.split("+")
		.map((part) => part.trim())
		.filter(Boolean);
	if (!parts.length) return null;

	const parsed: ParsedAccelerator = { ctrl: false, alt: false, shift: false, meta: false, cmdOrCtrl: false, key: "" };
	for (const part of parts) {
		const mod = MOD_TOKENS[part.toLowerCase()];
		if (mod) {
			parsed[mod] = true;
			continue;
		}
		if (parsed.key) return null;
		parsed.key = canonicalKey(part);
	}
	if (!parsed.key) return null;
	return parsed;
}

export function formatAccelerator(parsed: ParsedAccelerator, platform: ShortcutPlatform = "linux"): string {
	const mods: string[] = [];
	if (parsed.cmdOrCtrl) mods.push("CommandOrControl");
	else if (parsed.ctrl) mods.push("Ctrl");
	if (parsed.alt) mods.push("Alt");
	if (parsed.shift) mods.push("Shift");
	if (parsed.meta && !parsed.cmdOrCtrl) mods.push(platform === "darwin" ? "Command" : "Super");
	mods.push(parsed.key);
	return mods.join("+");
}

export function acceleratorFingerprint(parsed: ParsedAccelerator, platform: ShortcutPlatform): string {
	const ctrl = parsed.ctrl || (parsed.cmdOrCtrl && platform !== "darwin");
	const meta = parsed.meta || (parsed.cmdOrCtrl && platform === "darwin");
	return `${ctrl ? "c" : ""}${parsed.alt ? "a" : ""}${parsed.shift ? "s" : ""}${meta ? "m" : ""}+${parsed.key.toLowerCase()}`;
}

function hasNonShiftModifier(parsed: ParsedAccelerator): boolean {
	return parsed.ctrl || parsed.alt || parsed.meta || parsed.cmdOrCtrl;
}

export function reservedAcceleratorReason(parsed: ParsedAccelerator, platform: ShortcutPlatform): string | null {
	if (BLOCKED_KEYS.has(parsed.key.toLowerCase())) {
		return "Media and volume keys stay with the system media controls.";
	}
	if (!hasNonShiftModifier(parsed)) {
		return "Use Ctrl, Alt, or Cmd plus a key. Shift alone would steal typing.";
	}

	const fp = acceleratorFingerprint(parsed, platform);
	const denied = new Set<string>(["a+f4", "a+tab", "a+escape", "c+escape", "ca+delete", "cas+delete"]);
	if (platform === "win32" || platform === "linux") {
		for (const key of ["l", "d", "tab", "e", "r", "x", "i", "s"]) denied.add(`m+${key}`);
		denied.add("m+escape");
	}
	if (platform === "darwin") {
		for (const key of ["tab", "space", "q", "w", "h", "m"]) denied.add(`m+${key}`);
		denied.add("am+escape");
	}
	if (denied.has(fp)) return "This shortcut is reserved by the operating system.";
	return null;
}

export function validateGlobalAccelerator(
	raw: string,
	platform: ShortcutPlatform,
): { ok: true; accelerator: string; parsed: ParsedAccelerator } | { ok: false; reason: string } {
	const parsed = parseAccelerator(raw);
	if (!parsed) return { ok: false, reason: "Not a valid shortcut." };
	const reserved = reservedAcceleratorReason(parsed, platform);
	if (reserved) return { ok: false, reason: reserved };
	return { ok: true, accelerator: formatAccelerator(parsed, platform), parsed };
}

export function duplicateAcceleratorId(
	candidate: ParsedAccelerator,
	resolved: Record<string, string | null>,
	platform: ShortcutPlatform,
	exceptId?: string,
): string | null {
	const fp = acceleratorFingerprint(candidate, platform);
	for (const [id, accel] of Object.entries(resolved)) {
		if (!accel || id === exceptId) continue;
		const parsed = parseAccelerator(accel);
		if (!parsed) continue;
		if (acceleratorFingerprint(parsed, platform) === fp) return id;
	}
	return null;
}

const EVENT_KEY_ALIASES: Record<string, string> = {
	" ": "Space",
	Spacebar: "Space",
	ArrowLeft: "Left",
	ArrowRight: "Right",
	ArrowUp: "Up",
	ArrowDown: "Down",
	Esc: "Escape",
};

export function acceleratorFromKeyboardEvent(
	event: { key: string; code: string; ctrlKey: boolean; altKey: boolean; shiftKey: boolean; metaKey: boolean },
	platform: ShortcutPlatform,
): string | null {
	const lower = event.key.toLowerCase();
	if (["control", "shift", "alt", "meta", "os"].includes(lower)) return null;

	const parsed: ParsedAccelerator = {
		ctrl: false,
		alt: event.altKey,
		shift: event.shiftKey,
		meta: false,
		cmdOrCtrl: false,
		key: canonicalKey(EVENT_KEY_ALIASES[event.key] ?? event.key),
	};
	if (!parsed.key) return null;

	if (platform === "darwin") {
		parsed.cmdOrCtrl = event.metaKey;
		parsed.ctrl = event.ctrlKey;
	} else {
		parsed.cmdOrCtrl = event.ctrlKey;
		parsed.meta = event.metaKey;
	}
	return formatAccelerator(parsed, platform);
}
