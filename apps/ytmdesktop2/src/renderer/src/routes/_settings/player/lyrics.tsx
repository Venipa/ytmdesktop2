import { createFileRoute } from "@tanstack/react-router";
import { LyricsProvidersOrder } from "@/components/lyrics-providers-order";
import { SettingsCheckbox } from "@/components/settings-checkbox";
import { SettingsInput } from "@/components/settings-input";
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
							configKey="lyrics.autoOpenTab"
							defaultValue={true}
							disabled={!lyricsEnabled}
							description="Switch the player page to the Lyrics tab when lyrics for a new track are found. Once per track, so switching away by hand sticks."
						>
							Auto-open Lyrics tab
						</SettingsCheckbox>
						<SettingsCheckbox
							configKey="lyrics.dynamicLyrics"
							defaultValue={true}
							disabled={!lyricsEnabled}
							description="Continuously fill word-synced lyric text as it plays and gently enlarge the current line. Line-synced lyrics just highlight and enlarge."
						>
							Dynamic lyrics
						</SettingsCheckbox>
						<SettingsCheckbox
							configKey="lyrics.preferWordSync"
							defaultValue={true}
							disabled={!lyricsEnabled}
							description="Keep trying later providers for word/syllable timing before settling for line-synced lyrics. A few extra requests on line-only songs."
						>
							Prefer word-synced sources
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
							description="Show playback progress on the active line when the provider has no word/syllable cues. Only applies when Dynamic lyrics is off."
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
						Tried in order until one returns lyrics (default: Better Lyrics → Unison → LRCLib → YouTube captions). Better Lyrics and Unison
						can return syllable sync; LRCLib is line/plain (word sync when the entry has it); YouTube captions is line-only and
						uses the current video's own caption track. Toggle sources on or off and drag to reorder.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<FieldGroup>
						<LyricsProvidersOrder disabled={!lyricsEnabled} />
						<SettingsInput
							configKey="lyrics.betterLyricsApiKey"
							type="password"
							autoComplete="off"
							spellCheck={false}
							disabled={!lyricsEnabled}
							placeholder="Optional"
							label="Better Lyrics API key"
							hint={
								<>
									Sent as <code>X-API-Key</code>. Cached songs never need a key; uncached songs do, and Better
									Lyrics is not issuing new keys right now. Without one, play a song once in the Better Lyrics
									browser extension to cache it.
								</>
							}
						/>
					</FieldGroup>
				</CardContent>
				<CardFooter>
					<p className="text-xs text-muted-foreground">Site links open each provider&apos;s homepage or docs.</p>
				</CardFooter>
			</Card>
		</>
	);
}
