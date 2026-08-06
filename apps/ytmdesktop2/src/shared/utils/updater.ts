import semver from "semver";

export type ProgressInfo = {
	total: number;
	delta: number;
	transferred: number;
	percent: number;
	bytesPerSecond: number;
};

/** One changelog entry for the update timeline. */
export type ReleaseNoteEntry = {
	version: string;
	name: string | null;
	body: string | null;
	publishedAt: string | null;
};

/** Serializable update payload for renderer / tRPC. */
export type UpdateInfo = {
	version: string;
	releaseName: string | null;
	releaseNotes: string | null;
	releases: ReleaseNoteEntry[];
	releaseDate: string;
};

export type UpdateStatus = "idle" | "checking" | "available" | "downloading" | "ready" | "installing";

/** User-selected update feed channel. */
export type UpdateChannel = "stable" | "beta" | "alpha";

export const UPDATE_CHANNELS: readonly UpdateChannel[] = ["stable", "beta", "alpha"] as const;

export const UPDATE_CHANNEL_LABELS: Record<UpdateChannel, string> = {
	stable: "Stable",
	beta: "Beta",
	alpha: "Alpha",
};

function cleanSemver(version: string): string | null {
	return semver.clean(version.replace(/^v/i, ""), { loose: true });
}

/**
 * Classify a semver version into a release channel.
 * - stable: no prerelease
 * - beta: `-rc.<n>`
 * - alpha: `-a.<n>`
 */
export function getVersionChannel(version: string): UpdateChannel | null {
	const cleaned = cleanSemver(version);
	if (!cleaned) return null;
	const pre = semver.prerelease(cleaned, { loose: true });
	if (!pre?.length) return "stable";
	const id = String(pre[0]).toLowerCase();
	if (id === "rc") return "beta";
	if (id === "a") return "alpha";
	return null;
}

/**
 * Whether `version` may be offered on `channel`.
 * Stable → only stable.
 * Beta → rc OR stable (stable wins when newer).
 * Alpha → a OR rc OR stable.
 */
export function isVersionAllowedOnChannel(version: string, channel: UpdateChannel): boolean {
	const kind = getVersionChannel(version);
	if (!kind) return false;
	if (channel === "stable") return kind === "stable";
	if (channel === "beta") return kind === "beta" || kind === "stable";
	return kind === "alpha" || kind === "beta" || kind === "stable";
}

export function parseUpdateChannel(value: unknown): UpdateChannel {
	if (value === "beta" || value === "alpha" || value === "stable") return value;
	return "stable";
}

/** electron-updater channel string for a user channel. */
export function electronUpdaterChannelFor(channel: UpdateChannel): string {
	if (channel === "beta") return "rc";
	if (channel === "alpha") return "a";
	return "latest";
}
