import { authorName, githubRepoFetch, repoName, repoUrl } from "./github";
import type { GithubRelease } from "./github";

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

function pickPluginAsset(assets: GithubRelease["assets"]): string | null {
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

	const endpoints = ["/releases/tags/streamdeck-plugin", "/releases/latest"] as const;

	for (const endpoint of endpoints) {
		const { data, error } = await githubRepoFetch<GithubRelease>(endpoint);
		if (error || !data) continue;
		const url = pickPluginAsset(data.assets);
		if (url) return url;
	}

	return null;
}
