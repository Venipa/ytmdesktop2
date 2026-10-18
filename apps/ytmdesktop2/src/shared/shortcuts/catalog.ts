export const SHORTCUT_CATALOG = [
	{ id: "prev", label: "Previous track", defaultAccelerator: "Shift+Alt+Left" },
	{ id: "next", label: "Next track", defaultAccelerator: "Shift+Alt+Right" },
	{ id: "togglePlay", label: "Play / pause", defaultAccelerator: "Shift+Alt+Space" },
	{ id: "play", label: "Play", defaultAccelerator: null },
	{ id: "pause", label: "Pause", defaultAccelerator: null },
	{ id: "seekForward", label: "Seek forward 10s", defaultAccelerator: null },
	{ id: "seekBackward", label: "Seek backward 10s", defaultAccelerator: null },
	{ id: "volumeUp", label: "Volume up", defaultAccelerator: null },
	{ id: "volumeDown", label: "Volume down", defaultAccelerator: null },
	{ id: "like", label: "Like", defaultAccelerator: null },
	{ id: "dislike", label: "Dislike", defaultAccelerator: null },
	{ id: "shuffle", label: "Shuffle", defaultAccelerator: null },
	{ id: "repeat", label: "Repeat", defaultAccelerator: null },
] as const;

export type ShortcutActionId = (typeof SHORTCUT_CATALOG)[number]["id"];

export type ShortcutBinds = Partial<Record<ShortcutActionId, string | null>>;

export function isShortcutActionId(value: string): value is ShortcutActionId {
	return SHORTCUT_CATALOG.some((item) => item.id === value);
}

export function resolveShortcutBinds(overrides: ShortcutBinds | undefined): Record<ShortcutActionId, string | null> {
	const binds = overrides ?? {};
	const resolved = {} as Record<ShortcutActionId, string | null>;
	for (const item of SHORTCUT_CATALOG) {
		if (Object.prototype.hasOwnProperty.call(binds, item.id)) {
			const value = binds[item.id];
			resolved[item.id] = typeof value === "string" && value.trim() ? value : null;
			continue;
		}
		resolved[item.id] = item.defaultAccelerator;
	}
	return resolved;
}
