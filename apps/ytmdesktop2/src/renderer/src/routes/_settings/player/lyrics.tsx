import { createFileRoute } from "@tanstack/react-router";
import { LyricsProvidersOrder } from "@/components/lyrics-providers-order";
import { SettingsCheckbox } from "@/components/settings-checkbox";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { useSettingsState } from "@/hooks/use-settings";

export const Route = createFileRoute("/_settings/player/lyrics")({
	component: LyricsSettingsPage,
});

function LyricsSettingsPage() {
	const [lyricsEnabled] = useSettingsState<boolean>("lyrics.enabled", false);

	return (
		<>
			<Card>
				<CardHeader>
					<CardTitle>Lyrics</CardTitle>
					<CardDescription>
						Replace the YouTube Music Lyrics tab with timed lyrics. Word or syllable highlighting uses whatever the
						winning provider returns.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<FieldGroup>
						<SettingsCheckbox
							configKey="lyrics.enabled"
							description="When enabled, open the Lyrics tab in the player to see synced lines. Click a line or word to seek."
						>
							Enable lyrics
						</SettingsCheckbox>
						<SettingsCheckbox
							configKey="lyrics.showEvenIfInexact"
							defaultValue={true}
							disabled={!lyricsEnabled}
							description="For LRCLib matches, show lyrics when title/artist are close but not exact."
						>
							Allow approximate matches
						</SettingsCheckbox>
						<SettingsCheckbox
							configKey="lyrics.showTimeCodes"
							disabled={!lyricsEnabled}
							description="Prefix each line with its timestamp."
						>
							Show time codes
						</SettingsCheckbox>
						<SettingsCheckbox
							configKey="lyrics.showProgressBar"
							defaultValue={true}
							disabled={!lyricsEnabled}
							description="Fill the active lyric row as it plays when the provider has no word/syllable cues."
						>
							Show line progress
						</SettingsCheckbox>
					</FieldGroup>
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle>Providers</CardTitle>
					<CardDescription>
						Tried in order until one returns lyrics (default: Better Lyrics → Unison → LRCLib). Better Lyrics and Unison
						can return syllable sync; LRCLib is line/plain only. Toggle sources on or off and drag to reorder.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<LyricsProvidersOrder disabled={!lyricsEnabled} />
				</CardContent>
				<CardFooter>
					<p className="text-xs text-muted-foreground">Site links open each provider&apos;s homepage or docs.</p>
				</CardFooter>
			</Card>
		</>
	);
}
