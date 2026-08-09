import { C, Shell, type LayoutProps } from "../chrome";

export function TextLayout({ track, flags, className, status }: LayoutProps) {
	return (
		<Shell flags={flags} layout="text" className={className} playing={track.playing}>
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
				{flags.title ? (
					<div
						style={{
							fontSize: 20,
							fontWeight: 700,
							lineHeight: 1.2,
							whiteSpace: "nowrap",
							overflow: "hidden",
							textOverflow: "ellipsis",
						}}
					>
						{track.title}
					</div>
				) : null}
				{flags.artist ? (
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
				{status ? <div style={{ fontSize: 11, color: C.error }}>{status}</div> : null}
			</div>
		</Shell>
	);
}
