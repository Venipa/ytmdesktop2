export function LyricsSpinner({ label = "Loading lyrics…" }: { label?: string }) {
	return (
		<div className="ytmd-lyrics-status ytmd-lyrics-loading" role="status" aria-live="polite" aria-label={label}>
			<span className="ytmd-lyrics-spinner" aria-hidden>
				{Array.from({ length: 12 }, (_, i) => (
					<span key={i} className="ytmd-lyrics-spinner-blade" style={{ ["--i" as string]: i }} />
				))}
			</span>
			<span className="ytmd-lyrics-loading-label">{label}</span>
		</div>
	);
}
