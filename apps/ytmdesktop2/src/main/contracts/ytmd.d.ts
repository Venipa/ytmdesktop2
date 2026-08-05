declare module "ytmd" {
	export interface LastFMSettings {
		enabled: boolean;
		auth?: { key: string };
		name?: string;
	}
}
