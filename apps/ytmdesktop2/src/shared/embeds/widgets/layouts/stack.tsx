import { C, CardFrame, CoverArt, ProgressRow, Shell, showArt, showProgress, type LayoutProps } from "../chrome";

export function StackLayout({ track, flags, accent, src, className, status }: LayoutProps) {
	return (
		<Shell flags={flags} layout="stack" className={className} playing={track.playing}>
			<CardFrame flags={flags} accent={accent} src={src} style={{ width: 260 }}>
				<div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "12px 12px 14px", alignItems: "stretch" }}>
					{showArt(flags) ? (
						<div style={{ display: "flex", justifyContent: "center" }}>
							<CoverArt src={src} accent={accent} size={220} />
						</div>
					) : null}
					<div style={{ minWidth: 0, textAlign: "center" }}>
						{flags.title ? <div style={{ fontSize: 16, fontWeight: 650, lineHeight: 1.25 }}>{track.title}</div> : null}
						{flags.artist ? <div style={{ marginTop: 4, fontSize: 13, color: C.muted }}>{track.artist}</div> : null}
					</div>
					{showProgress(flags) ? <ProgressRow track={track} accent={accent} /> : null}
					{status ? <div style={{ fontSize: 11, color: C.error, textAlign: "center" }}>{status}</div> : null}
				</div>
			</CardFrame>
		</Shell>
	);
}
