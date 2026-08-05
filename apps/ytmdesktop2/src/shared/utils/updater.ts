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
