import { C, Shell, emptyLabel, type LayoutProps } from "../chrome";

export function TextLayout({ track, flags, className, status }: LayoutProps) {
	const idle = !track;
	const label = emptyLabel(status);

	return (
		<Shell flags={flags} layout="text" className={className} playing={track?.playing} idle={idle}>
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: 4,
					padding: flags.transparent ? 4 : 12,
					maxWidth: 420,
					textShadow: "0 1px 10px rgba(0,0,0,0.85)",
				}}
			>
				{flags.title || idle ? (
					<div
						style={{
							fontSize: 20,
							fontWeight: 700,
							lineHeight: 1.2,
							whiteSpace: "nowrap",
							overflow: "hidden",
							textOverflow: "ellipsis",
							color: idle ? C.muted : undefined,
						}}
					>
						{idle ? label : track.title}
					</div>
				) : null}
				{!idle && flags.artist ? (
					<div
						style={{
							fontSize: 14,
							color: C.muted,
							whiteSpace: "nowrap",
							overflow: "hidden",
							textOverflow: "ellipsis",
						}}
					>
						{track.artist}
					</div>
				) : null}
				{!idle && status ? <div style={{ fontSize: 11, color: C.error }}>{status}</div> : null}
			</div>
		</Shell>
	);
}
