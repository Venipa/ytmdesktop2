import type { EmbedFlags, EmbedLayout } from "../../flags";
import { C, CardFrame, Shell } from "../chrome";

export function IdleLayout({
	flags,
	layout,
	fill,
	className,
	status,
}: {
	flags: EmbedFlags;
	layout: EmbedLayout;
	fill?: boolean;
	className?: string;
	status?: string | null;
}) {
	return (
		<Shell flags={flags} layout={layout} fill={fill} className={className} idle>
			<CardFrame
				flags={flags}
				accent={C.fallbackAccent}
				src={null}
				style={
					fill
						? { width: "100%", height: "100%", minHeight: 180, borderRadius: 0, border: "none" }
						: { minWidth: layout === "ticker" || layout === "badge" ? undefined : 280, padding: 0 }
				}
			>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: fill ? "center" : undefined,
						padding: layout === "badge" || layout === "ticker" ? "10px 14px" : 16,
						opacity: 0.85,
						fontSize: 14,
						color: C.muted,
						width: fill ? "100%" : undefined,
						height: fill ? "100%" : undefined,
					}}
				>
					{status?.trim() || "Nothing playing"}
				</div>
			</CardFrame>
		</Shell>
	);
}
