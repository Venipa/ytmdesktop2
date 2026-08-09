export const LYRICS_PROVIDER_IDS = ["better-lyrics", "unison", "lrclib"] as const;

export type LyricsProviderId = (typeof LYRICS_PROVIDER_IDS)[number];

export interface LyricsProviderMeta {
	id: LyricsProviderId;
	label: string;
	/** Sync capabilities shown in settings. */
	syncLevels: string;
	href: string;
}

export interface LyricsProviderEntry {
	id: LyricsProviderId;
	enabled: boolean;
}

export const LYRICS_PROVIDER_META: Record<LyricsProviderId, LyricsProviderMeta> = {
	"better-lyrics": {
		id: "better-lyrics",
		label: "Better Lyrics",
		syncLevels: "Syllable & line",
		href: "https://betterlyrics.org",
	},
	unison: {
		id: "unison",
		label: "Unison",
		syncLevels: "Syllable, line & plain",
		href: "https://github.com/better-lyrics/unison",
	},
	lrclib: {
		id: "lrclib",
		label: "LRCLib",
		syncLevels: "Line & plain",
		href: "https://lrclib.net",
	},
};

export const DEFAULT_LYRICS_PROVIDERS: LyricsProviderEntry[] = [
	{ id: "better-lyrics", enabled: true },
	{ id: "unison", enabled: true },
	{ id: "lrclib", enabled: true },
];

function isProviderId(value: unknown): value is LyricsProviderId {
	return typeof value === "string" && (LYRICS_PROVIDER_IDS as readonly string[]).includes(value);
}

/**
 * Normalize settings: supports legacy `string[]` and `{ id, enabled }[]`.
 * Keeps order, fills missing defaults, drops unknowns.
 */
export function normalizeLyricsProviders(raw: unknown): LyricsProviderEntry[] {
	const seen = new Set<LyricsProviderId>();
	const out: LyricsProviderEntry[] = [];

	if (Array.isArray(raw)) {
		for (const item of raw) {
			if (isProviderId(item)) {
				if (seen.has(item)) continue;
				seen.add(item);
				out.push({ id: item, enabled: true });
				continue;
			}
			if (!item || typeof item !== "object") continue;
			const id = (item as { id?: unknown }).id;
			if (!isProviderId(id) || seen.has(id)) continue;
			seen.add(id);
			const enabled = (item as { enabled?: unknown }).enabled;
			out.push({ id, enabled: enabled !== false });
		}
	}

	for (const entry of DEFAULT_LYRICS_PROVIDERS) {
		if (!seen.has(entry.id)) out.push({ ...entry });
	}
	return out;
}

/** Enabled provider ids in priority order (for search). */
export function enabledLyricsProviderIds(raw: unknown): LyricsProviderId[] {
	return normalizeLyricsProviders(raw)
		.filter((entry) => entry.enabled)
		.map((entry) => entry.id);
}

/** Immutable reorder for settings list / ↑↓ / drag-drop. */
export function moveLyricsProvider(
	entries: LyricsProviderEntry[],
	from: number,
	to: number,
): LyricsProviderEntry[] | null {
	if (from === to || from < 0 || to < 0 || from >= entries.length || to >= entries.length) return null;
	const next = [...entries];
	const [item] = next.splice(from, 1);
	next.splice(to, 0, item);
	return next;
}

export function setLyricsProviderEnabled(
	entries: LyricsProviderEntry[],
	id: LyricsProviderId,
	enabled: boolean,
): LyricsProviderEntry[] {
	return entries.map((entry) => (entry.id === id ? { ...entry, enabled } : entry));
}

export function lyricsProviderLabel(id: LyricsProviderId | string | undefined): string {
	if (!id) return "Unknown";
	return LYRICS_PROVIDER_META[id as LyricsProviderId]?.label ?? id;
}
