import {
  C,
  CardFrame,
  CoverArt,
  emptyLabel,
  type LayoutProps,
  ProgressRow,
  Shell,
  showArt,
  showProgress,
} from "../chrome";

export function CardLayout({ track, flags, accent, src, className, status }: LayoutProps) {
	const compact = flags.layout === "compact";
	const coverSize = compact ? 48 : 64;
	const idle = !track;
	const label = emptyLabel(status);

	return (
		<Shell flags={flags} layout={flags.layout} className={className} playing={track?.playing} idle={idle}>
			<CardFrame
				flags={flags}
				accent={accent}
				src={idle ? null : src}
				style={{
					minWidth: compact ? 260 : 320,
					maxWidth: compact ? 360 : 440,
				}}
			>
				<div style={{ display: "flex", flexDirection: "column", padding: compact ? "10px 12px" : "12px 14px" }}>
					<div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
						{showArt(flags) ? <CoverArt src={idle ? null : src} accent={accent} size={coverSize} /> : null}
						<div style={{ minWidth: 0, flex: 1, paddingTop: 2 }}>
							{flags.title || idle ? (
								<div
									style={{
										fontSize: compact ? 14 : 16,
										fontWeight: 650,
										lineHeight: 1.25,
										whiteSpace: "nowrap",
										overflow: "hidden",
										textOverflow: "ellipsis",
										color: idle ? C.muted : undefined,
									}}
									title={idle ? label : track.title}
								>
									{idle ? label : track.title}
								</div>
							) : null}
							{!idle && flags.artist ? (
								<div
									style={{
										marginTop: 2,
										fontSize: compact ? 12 : 13,
										color: C.muted,
										whiteSpace: "nowrap",
										overflow: "hidden",
										textOverflow: "ellipsis",
									}}
									title={track.artist}
								>
									{track.artist}
								</div>
							) : null}
						</div>
					</div>
					{!idle && showProgress(flags) ? <ProgressRow track={track} accent={accent} compact={compact} /> : null}
					{!idle && status ? <div style={{ marginTop: 8, fontSize: 11, color: C.error }}>{status}</div> : null}
				</div>
			</CardFrame>
		</Shell>
	);
}
