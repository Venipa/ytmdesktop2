import { BleedArt, C, Shell, emptyLabel, formatTime, type LayoutProps } from "../chrome";

export function FullscreenLayout({ track, flags, accent, src, className, status }: LayoutProps) {
	const idle = !track;
	const label = emptyLabel(status);
	const pct =
		!idle && track.duration > 0 ? Math.min(100, Math.max(0, (track.progress / track.duration) * 100)) : 0;

	return (
		<Shell flags={flags} layout="fullscreen" fill className={className} playing={track?.playing} idle={idle}>
			<div style={{ position: "relative", width: "100%", height: "100%", minHeight: 240, overflow: "hidden", background: C.bg }}>
				<BleedArt src={idle ? null : src} accent={accent} />
				<div
					style={{
						position: "absolute",
						inset: 0,
						background: "linear-gradient(transparent 35%, rgba(0,0,0,0.78) 100%)",
					}}
				/>
				<div
					style={{
						position: "absolute",
						left: 0,
						right: 0,
						bottom: 0,
						padding: "28px 36px",
						display: "flex",
						flexDirection: "column",
						gap: 8,
						maxWidth: 960,
					}}
				>
					{flags.title || idle ? (
						<div
							style={{
								fontSize: 36,
								fontWeight: 700,
								lineHeight: 1.15,
								textShadow: "0 2px 20px rgba(0,0,0,0.7)",
								color: idle ? C.muted : undefined,
							}}
						>
							{idle ? label : track.title}
						</div>
					) : null}
					{!idle && flags.artist ? (
						<div style={{ fontSize: 18, color: C.muted, textShadow: "0 1px 12px rgba(0,0,0,0.7)" }}>{track.artist}</div>
					) : null}
					{!idle && flags.progress ? (
						<div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4, maxWidth: 480 }}>
							<div style={{ height: 6, borderRadius: 999, background: C.track, overflow: "hidden" }}>
								<div
									style={{
										height: "100%",
										width: `${pct}%`,
										backgroundColor: accent,
										borderRadius: 999,
										transition: "width 100ms ease-out",
									}}
								/>
							</div>
							<div
								style={{
									display: "flex",
									gap: 10,
									fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
									fontSize: 12,
									color: C.muted,
									fontVariantNumeric: "tabular-nums",
								}}
							>
								<span>{formatTime(track.progress)}</span>
								<span>/</span>
								<span>{formatTime(track.duration)}</span>
							</div>
						</div>
					) : null}
					{!idle && status ? <div style={{ fontSize: 12, color: C.error }}>{status}</div> : null}
				</div>
			</div>
		</Shell>
	);
}
