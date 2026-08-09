import { C, CardFrame, CoverArt, ProgressRow, Shell, showArt, showProgress, type LayoutProps } from "../chrome";

export function CardLayout({ track, flags, accent, src, className, status }: LayoutProps) {
	const compact = flags.layout === "compact";
	const coverSize = compact ? 48 : 64;

	return (
		<Shell flags={flags} layout={flags.layout} className={className} playing={track.playing}>
			<CardFrame
				flags={flags}
				accent={accent}
				src={src}
				style={{
					minWidth: compact ? 260 : 320,
					maxWidth: compact ? 360 : 440,
				}}
			>
				<div style={{ display: "flex", flexDirection: "column", padding: compact ? "10px 12px" : "12px 14px" }}>
					<div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
						{showArt(flags) ? <CoverArt src={src} accent={accent} size={coverSize} /> : null}
						<div style={{ minWidth: 0, flex: 1, paddingTop: 2 }}>
							{flags.title ? (
								<div
									style={{
										fontSize: compact ? 14 : 16,
										fontWeight: 650,
										lineHeight: 1.25,
										whiteSpace: "nowrap",
										overflow: "hidden",
										textOverflow: "ellipsis",
									}}
									title={track.title}
								>
									{track.title}
								</div>
							) : null}
							{flags.artist ? (
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
					{showProgress(flags) ? <ProgressRow track={track} accent={accent} compact={compact} /> : null}
					{status ? <div style={{ marginTop: 8, fontSize: 11, color: C.error }}>{status}</div> : null}
				</div>
			</CardFrame>
		</Shell>
	);
}
