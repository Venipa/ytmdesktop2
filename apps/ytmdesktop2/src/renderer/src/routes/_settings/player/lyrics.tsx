import { createFileRoute } from "@tanstack/react-router";
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
					<CardTitle>Synced lyrics</CardTitle>
					<CardDescription>Replace the YouTube Music Lyrics tab with timed lyrics from LRCLib.</CardDescription>
				</CardHeader>
				<CardContent>
					<FieldGroup>
						<SettingsCheckbox
							configKey="lyrics.enabled"
							description="When enabled, open the Lyrics tab in the player to see synced lines. Click a line to seek."
						>
							Enable synced lyrics
						</SettingsCheckbox>
						<SettingsCheckbox
							configKey="lyrics.showEvenIfInexact"
							defaultValue={true}
							disabled={!lyricsEnabled}
							description="Show lyrics when the match is approximate (title/artist close but not exact)."
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
							description="Fill the active lyric row with a muted translucent background as it plays (skipped on lines with word sync)."
						>
							Show line progress
						</SettingsCheckbox>
						<SettingsCheckbox
							configKey="lyrics.showWordSync"
							disabled={!lyricsEnabled}
							description="Highlight each word while the line plays. Uses enhanced timestamps when present; otherwise estimates from line timing. Single-word and duet rows keep normal line sync."
						>
							Show word sync
						</SettingsCheckbox>
					</FieldGroup>
				</CardContent>
				<CardFooter>
					<a href="https://lrclib.net" target="_blank" rel="noreferrer" className="text-xs text-primary underline-offset-4 hover:underline">
						Lyrics provided by LRCLib
					</a>
				</CardFooter>
			</Card>
		</>
	);
}
