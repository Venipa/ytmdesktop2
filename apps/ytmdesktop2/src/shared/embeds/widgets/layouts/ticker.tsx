import { C, CardFrame, CoverArt, Shell, showArt, tickerLine, type LayoutProps } from "../chrome";

export function TickerLayout({ track, flags, accent, src, className, status }: LayoutProps) {
	const line = tickerLine(track, flags);

	return (
		<Shell flags={flags} layout="ticker" className={className} playing={track.playing}>
			<style>{`
				@keyframes ytmd-embed-ticker {
					0% { transform: translateX(0); }
					100% { transform: translateX(-50%); }
				}
			`}</style>
			<CardFrame flags={flags} accent={accent} src={src} style={{ maxWidth: 520, height: 52 }}>
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
					{showArt(flags) ? <CoverArt src={src} accent={accent} size={32} /> : null}
					<div
						style={{
							flex: 1,
							minWidth: 0,
							display: "flex",
							alignItems: "center",
							overflow: "hidden",
							height: "100%",
							maskImage: "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)",
						}}
					>
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
					</div>
					{status ? <div style={{ fontSize: 10, color: C.error, flexShrink: 0 }}>{status}</div> : null}
				</div>
			</CardFrame>
		</Shell>
	);
}
