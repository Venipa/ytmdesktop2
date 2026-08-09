import type { EmbedFlags, EmbedLayout } from "../flags";
import type { NowPlayingViewModel } from "../types";
import { C, showArt, useAlignedArtDisplay } from "./chrome";
import { BadgeLayout } from "./layouts/badge";
import { CardLayout } from "./layouts/card";
import { FullscreenLayout } from "./layouts/fullscreen";
import { StackLayout } from "./layouts/stack";
import { TextLayout } from "./layouts/text";
import { TickerLayout } from "./layouts/ticker";

export interface NowPlayingWidgetProps {
	readonly track: NowPlayingViewModel | null;
	readonly flags: EmbedFlags;
	readonly className?: string;
	/** Optional status line (e.g. connecting / unauthorized / reconnecting). */
	readonly status?: string | null;
}

/**
 * Presentational now-playing widget — tray-view visual language (bleed, cover, type, progress).
 * Null track → layout-matched empty state (socket close / nothing playing).
 */
export function NowPlayingWidget({ track, flags, className, status }: NowPlayingWidgetProps) {
	const layout: EmbedLayout = flags.layout ?? "default";
	const liveAccent = track?.accent?.trim() || C.fallbackAccent;
	const rawThumb = showArt(flags) ? track?.thumbnailUrl ?? null : null;
	const { src: artSrc, accent: displayAccent } = useAlignedArtDisplay(rawThumb, track ? liveAccent : null);
	const accent = displayAccent ?? liveAccent;
	const src = track ? artSrc : null;
	const props = { track, flags, accent, src, className, status };

	switch (layout) {
		case "fullscreen":
			return <FullscreenLayout {...props} />;
		case "stack":
			return <StackLayout {...props} />;
		case "ticker":
			return <TickerLayout {...props} />;
		case "badge":
			return <BadgeLayout {...props} />;
		case "text":
			return <TextLayout {...props} />;
		case "compact":
		case "default":
		default:
			return <CardLayout {...props} />;
	}
}
