import type { EmbedStateLike, EmbedTrackLike, NowPlayingViewModel } from "./types";

function pickThumb(track: EmbedTrackLike): string | null {
	const meta = track.meta?.thumbnail?.trim();
	if (meta) return meta;
	const fromList = (list?: Array<{ url?: string; width?: number }>) => {
		if (!list?.length) return null;
		const sorted = [...list].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
		return sorted[0]?.url?.trim() || null;
	};
	return fromList(track.context?.thumbnail?.thumbnails) ?? fromList(track.video?.thumbnail?.thumbnails) ?? null;
}

export function mapTrackToViewModel(
	track: EmbedTrackLike | null | undefined,
	state: EmbedStateLike | null | undefined = null,
): NowPlayingViewModel | null {
	if (!track?.video?.title) return null;
	const durationFromState = state?.duration;
	const durationFromMeta = track.meta?.duration;
	const duration =
		typeof durationFromState === "number" && durationFromState > 0
			? durationFromState
			: typeof durationFromMeta === "number" && durationFromMeta > 0
				? durationFromMeta
				: 0;

	return {
		videoId: track.video.videoId?.trim() || null,
		title: track.video.title,
		artist: track.video.author?.trim() || "Unknown artist",
		thumbnailUrl: pickThumb(track),
		progress: typeof state?.progress === "number" ? Math.max(0, state.progress) : 0,
		duration,
		playing: state?.playing === true,
		accent: state?.accent?.trim() || null,
	};
}

/**
 * Local API thumbnail URL (served from thumb-cache).
 * `id` busts browser cache on track change.
 */
export function buildApiThumbnailUrl(
	baseUrl: string,
	options: { videoId?: string | null; token?: string | null } = {},
): string {
	const root = baseUrl.replace(/\/$/, "");
	const url = new URL("/track/thumbnail", `${root}/`);
	if (options.videoId) url.searchParams.set("id", options.videoId);
	if (options.token) url.searchParams.set("token", options.token);
	return url.toString();
}

/** Prefer local API thumb when a video id is known. */
export function withApiThumbnail(
	track: NowPlayingViewModel | null,
	baseUrl: string,
	token?: string | null,
): NowPlayingViewModel | null {
	if (!track) return null;
	if (!track.videoId && !track.thumbnailUrl) return track;
	return {
		...track,
		thumbnailUrl: buildApiThumbnailUrl(baseUrl, { videoId: track.videoId, token }),
	};
}
