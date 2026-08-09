/** Presentational now-playing payload — no Electron / tRPC deps. */
export interface NowPlayingViewModel {
	readonly videoId: string | null;
	readonly title: string;
	readonly artist: string;
	readonly thumbnailUrl: string | null;
	readonly progress: number;
	readonly duration: number;
	readonly playing: boolean;
	readonly accent: string | null;
}

/** Slim track shape accepted by {@link mapTrackToViewModel}. */
export interface EmbedTrackLike {
	readonly video?: {
		readonly videoId?: string;
		readonly title?: string;
		readonly author?: string;
		readonly thumbnail?: { thumbnails?: Array<{ url?: string; width?: number }> };
	};
	readonly meta?: {
		readonly thumbnail?: string;
		readonly duration?: number;
	};
	readonly context?: {
		readonly thumbnail?: { thumbnails?: Array<{ url?: string; width?: number }> };
	};
}

/** Slim state shape accepted by {@link mapTrackToViewModel}. */
export interface EmbedStateLike {
	readonly progress?: number;
	readonly duration?: number;
	readonly playing?: boolean;
	readonly accent?: string | null;
}
