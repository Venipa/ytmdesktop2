import { motion } from "motion/react";
import { useLayoutEffect, useRef, useState } from "react";
import {
	ART_DURATION,
	ART_EASE,
	CARD_RADIUS,
	C,
	CardFrame,
	CoverArt,
	Shell,
	emptyLabel,
	showArt,
	type LayoutProps,
} from "../chrome";

const BADGE_MAX_WIDTH = 360;

/** Compact horizontal card — width lerps with motion when text/art changes. */
export function BadgeLayout({ track, flags, accent, src, className, status }: LayoutProps) {
	const contentRef = useRef<HTMLDivElement>(null);
	const [width, setWidth] = useState<number | undefined>(undefined);
	const idle = !track;
	const label = emptyLabel(status);

	useLayoutEffect(() => {
		const el = contentRef.current;
		if (!el) return;
		const next = Math.min(BADGE_MAX_WIDTH, Math.ceil(el.scrollWidth));
		setWidth((prev) => (prev === next ? prev : next));
	}, [track?.title, track?.artist, track?.videoId, flags.art, flags.title, flags.artist, status, src, idle, label]);

	return (
		<Shell flags={flags} layout="badge" className={className} playing={track?.playing} idle={idle}>
			<motion.div
				initial={false}
				animate={width != null ? { width } : undefined}
				transition={{ duration: ART_DURATION, ease: ART_EASE }}
				style={{
					maxWidth: BADGE_MAX_WIDTH,
					overflow: "hidden",
					borderRadius: CARD_RADIUS,
				}}
			>
				<CardFrame
					flags={flags}
					accent={accent}
					src={idle ? null : src}
					style={{
						width: "max-content",
						maxWidth: BADGE_MAX_WIDTH,
						borderRadius: CARD_RADIUS,
					}}
				>
					<div
						ref={contentRef}
						style={{
							display: "inline-flex",
							alignItems: "center",
							gap: 10,
							padding: "10px 14px",
							minWidth: 0,
							boxSizing: "border-box",
						}}
					>
						{showArt(flags) ? <CoverArt src={idle ? null : src} accent={accent} size={36} /> : null}
						<div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
							{flags.title || idle ? (
								<div
									style={{
										fontSize: 13,
										fontWeight: 650,
										whiteSpace: "nowrap",
										overflow: "hidden",
										textOverflow: "ellipsis",
										maxWidth: 220,
										color: idle ? C.muted : undefined,
									}}
								>
									{idle ? label : track.title}
								</div>
							) : null}
							{!idle && flags.artist ? (
								<div
									style={{
										fontSize: 11,
										color: C.muted,
										whiteSpace: "nowrap",
										overflow: "hidden",
										textOverflow: "ellipsis",
										maxWidth: 220,
									}}
								>
									{track.artist}
								</div>
							) : null}
						</div>
						{!idle && status ? <div style={{ fontSize: 10, color: C.error, flexShrink: 0 }}>{status}</div> : null}
					</div>
				</CardFrame>
			</motion.div>
		</Shell>
	);
}
