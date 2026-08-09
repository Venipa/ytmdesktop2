import { C, CardFrame, CoverArt, Shell, emptyLabel, showArt, tickerLine, type LayoutProps } from "../chrome";

export function TickerLayout({ track, flags, accent, src, className, status }: LayoutProps) {
	const idle = !track;
	const label = emptyLabel(status);
	const line = idle ? label : tickerLine(track, flags);

	return (
		<Shell flags={flags} layout="ticker" className={className} playing={track?.playing} idle={idle}>
			{!idle ? (
				<style>{`
					@keyframes ytmd-embed-ticker {
						0% { transform: translateX(0); }
						100% { transform: translateX(-50%); }
					}
				`}</style>
			) : null}
			<CardFrame flags={flags} accent={accent} src={idle ? null : src} style={{ maxWidth: 520, height: 52 }}>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: 10,
						height: "100%",
						padding: "0 14px",
						minWidth: 0,
						boxSizing: "border-box",
					}}
				>
					{showArt(flags) ? <CoverArt src={idle ? null : src} accent={accent} size={32} /> : null}
					<div
						style={{
							flex: 1,
							minWidth: 0,
							display: "flex",
							alignItems: "center",
							overflow: "hidden",
							height: "100%",
							maskImage: idle
								? undefined
								: "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)",
						}}
					>
						{idle ? (
							<div
								style={{
									fontSize: 14,
									fontWeight: 600,
									lineHeight: 1,
									color: C.muted,
									whiteSpace: "nowrap",
									overflow: "hidden",
									textOverflow: "ellipsis",
								}}
							>
								{line}
							</div>
						) : (
							<div
								style={{
									display: "inline-flex",
									alignItems: "center",
									whiteSpace: "nowrap",
									gap: 48,
									animation: "ytmd-embed-ticker 18s linear infinite",
									fontSize: 14,
									fontWeight: 600,
									lineHeight: 1,
								}}
							>
								<span>{line}</span>
								<span aria-hidden>{line}</span>
							</div>
						)}
					</div>
					{!idle && status ? <div style={{ fontSize: 10, color: C.error, flexShrink: 0 }}>{status}</div> : null}
				</div>
			</CardFrame>
		</Shell>
	);
}
