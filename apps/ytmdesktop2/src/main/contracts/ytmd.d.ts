declare module "ytmd" {
	export interface LastFMSettings {
		enabled: boolean;
		auth?: { key: string };
		name?: string;
		/** Scrobble only the first artist of a song with several artists. */
		firstArtistOnly?: boolean;
	}
}
