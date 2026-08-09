import { isCachableThumbUrl } from "@shared/media/appThumbUrl";

/** Best-effort remote album art URL from a track-like payload. */
export function resolveTrackThumbnailUrl(track: {
	meta?: { thumbnail?: string | null };
	video?: { thumbnail?: { thumbnails?: Array<{ url?: string; width?: number }> } };
	context?: { thumbnail?: { thumbnails?: Array<{ url?: string; width?: number }> } };
} | null | undefined): string | null {
	if (!track) return null;
	const meta = track.meta?.thumbnail?.trim();
	if (meta && isCachableThumbUrl(meta)) return meta;
	if (meta) return meta;

	const fromList = (list?: Array<{ url?: string; width?: number }>) => {
		if (!list?.length) return null;
		const sorted = [...list].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
		const url = sorted[0]?.url?.trim();
		return url || null;
	};

	return fromList(track.context?.thumbnail?.thumbnails) ?? fromList(track.video?.thumbnail?.thumbnails) ?? null;
}
