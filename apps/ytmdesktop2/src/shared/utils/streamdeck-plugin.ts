import { apiRepoUrl, authorName, repoName, repoUrl } from "./github";

/** Optional bake-time URL to the newest `.streamDeckPlugin` file. */
export const streamDeckPluginFileEnv =
	(import.meta.env.VITE_STREAMDECK_PLUGIN_FILE as string | undefined)?.trim() ||
	(import.meta.env.STREAMDECK_PLUGIN_FILE as string | undefined)?.trim() ||
	"";

const docsBaseFromEnv = (import.meta.env.VITE_DOCS_URL as string | undefined)?.trim().replace(/\/+$/, "");

/** Docs site Stream Deck install page (GitHub Pages by default). */
export function getStreamDeckDocsUrl(): string {
	if (docsBaseFromEnv) {
		return `${docsBaseFromEnv}/docs/integrations/streamdeck/`;
	}
	return `https://${authorName.toLowerCase()}.github.io/${repoName}/docs/integrations/streamdeck/`;
}

export function getStreamDeckReleasesUrl(): string {
	return `${repoUrl}/releases/tag/streamdeck-plugin`;
}

interface GitHubReleaseAsset {
	name: string;
	browser_download_url: string;
}

interface GitHubReleaseResponse {
	assets?: GitHubReleaseAsset[];
	html_url?: string;
}

function pickPluginAsset(assets: GitHubReleaseAsset[] | undefined): string | null {
	const asset = assets?.find((item) => item.name.toLowerCase().endsWith(".streamdeckplugin"));
	return asset?.browser_download_url ?? null;
}

/**
 * Resolve newest plugin download URL.
 * Prefer `VITE_STREAMDECK_PLUGIN_FILE` / `STREAMDECK_PLUGIN_FILE`.
 * Else fetch dedicated `streamdeck-plugin` release, then latest release assets.
 *
 * Note: GitHub Actions workflow artifacts are authenticated + expire — not used here.
 */
export async function resolveStreamDeckPluginDownloadUrl(): Promise<string | null> {
	if (streamDeckPluginFileEnv) {
		return streamDeckPluginFileEnv;
	}

	const endpoints = [`${apiRepoUrl}/releases/tags/streamdeck-plugin`, `${apiRepoUrl}/releases/latest`] as const;

	for (const endpoint of endpoints) {
		try {
			const response = await fetch(endpoint, {
				headers: {
					Accept: "application/vnd.github+json",
				},
			});
			if (!response.ok) continue;
			const data = (await response.json()) as GitHubReleaseResponse;
			const url = pickPluginAsset(data.assets);
			if (url) return url;
		} catch {
			// try next endpoint
		}
	}

	return null;
}
