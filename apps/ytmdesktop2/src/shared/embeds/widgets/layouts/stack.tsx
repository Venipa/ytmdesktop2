import {
	C,
	CardFrame,
	CoverArt,
	ProgressRow,
	Shell,
	emptyLabel,
	showArt,
	showProgress,
	type LayoutProps,
} from "../chrome";

export function StackLayout({ track, flags, accent, src, className, status }: LayoutProps) {
	const idle = !track;
	const label = emptyLabel(status);

	return (
		<Shell flags={flags} layout="stack" className={className} playing={track?.playing} idle={idle}>
			<CardFrame flags={flags} accent={accent} src={idle ? null : src} style={{ width: 260 }}>
				<div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "12px 12px 14px", alignItems: "stretch" }}>
					{showArt(flags) ? (
						<div style={{ display: "flex", justifyContent: "center" }}>
							<CoverArt src={idle ? null : src} accent={accent} size={220} />
						</div>
					) : null}
					<div style={{ minWidth: 0, textAlign: "center" }}>
						{flags.title || idle ? (
							<div
								style={{
									fontSize: 16,
									fontWeight: 650,
									lineHeight: 1.25,
									color: idle ? C.muted : undefined,
								}}
							>
								{idle ? label : track.title}
							</div>
						) : null}
						{!idle && flags.artist ? (
							<div style={{ marginTop: 4, fontSize: 13, color: C.muted }}>{track.artist}</div>
						) : null}
					</div>
					{!idle && showProgress(flags) ? <ProgressRow track={track} accent={accent} /> : null}
					{!idle && status ? <div style={{ fontSize: 11, color: C.error, textAlign: "center" }}>{status}</div> : null}
				</div>
			</CardFrame>
		</Shell>
	);
}
