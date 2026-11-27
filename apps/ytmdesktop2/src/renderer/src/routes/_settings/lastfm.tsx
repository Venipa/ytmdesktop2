import { createFileRoute } from "@tanstack/react-router";
import { SettingsCheckbox } from "@/components/settings-checkbox";
import { SettingsGroup, SettingsRow } from "@/components/settings-group";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useLastFm } from "@/hooks/use-lastfm";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_settings/lastfm")({
	component: LastFmSettingsPage,
});

function LastFmSettingsPage() {
	const { lastFM, enabled, isBusy, toggleLastFM, reauthLastFM } = useLastFm();

	const statusLabel = lastFM.connected
		? lastFM.name
			? `Connected as ${lastFM.name}`
			: "Connected"
		: lastFM.processing
			? "Waiting for authorization…"
			: lastFM.error
				? "Connection error"
				: enabled
					? "Not connected"
					: "Disconnected";

	return (
		<SettingsGroup
			title="Last.fm"
			description="Scrobble tracks to your Last.fm profile. Authorization opens your browser; Last.fm returns via ytmd:// or we finish once you approve."
		>
			<SettingsRow label="Enable Last.fm" description="Connect to scrobble your listening history." disabled={isBusy && !enabled}>
				<Switch
					checked={enabled}
					disabled={isBusy && !enabled}
					onCheckedChange={(next) => {
						if (next === enabled) return;
						void toggleLastFM(next);
					}}
				/>
			</SettingsRow>
			<SettingsCheckbox
				configKey="lastfm.firstArtistOnly"
				defaultValue={false}
				nested
				disabled={!enabled}
				description="For songs with several artists, scrobble only the first one.">
				Scrobble only the first artist
			</SettingsCheckbox>
			<SettingsRow
				label="Account"
				description={
					<span
						className={cn(
							lastFM.connected && "text-green-500",
							lastFM.error && !lastFM.connected && "text-destructive",
						)}
					>
						{statusLabel}
					</span>
				}
			>
				<Button type="button" size="sm" variant="outline" disabled={isBusy} onClick={() => void reauthLastFM()}>
					{lastFM.processing ? "Authorizing…" : "Re-authenticate"}
				</Button>
			</SettingsRow>
		</SettingsGroup>
	);
}
