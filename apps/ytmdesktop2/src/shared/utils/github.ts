import { createFetch } from "@better-fetch/fetch";

const REPO_WITH_AUTHOR = import.meta.env.VITE_GITHUB_REPOSITORY;
const [GITHUB_AUTHOR, GITHUB_REPOSITORY] = REPO_WITH_AUTHOR.split("/", 2);

export const apiBaseUrl = "https://api.github.com/repos/" + GITHUB_REPOSITORY;
export const sponsorUrl = "https://github.com/sponsors/" + GITHUB_AUTHOR;

export const repoName = GITHUB_REPOSITORY as string;
export const authorName = GITHUB_AUTHOR;
export const repoUrl = `https://github.com/${REPO_WITH_AUTHOR}`;
export const apiRepoUrl = `https://api.github.com/repos/${REPO_WITH_AUTHOR}`;
export const versionRegex = /^(v[\d,.]+(\-rc\d+)?)?(\ ?-\ ?)/;
export const compareUrlParse = new RegExp("(?:\\*{2})?Full Changelog(?:\\*{2})?: (" + repoUrl + "/compare/([a-zA-Z0-9.-]+))", "g");

export interface GithubReleaseAsset {
	name: string;
	browser_download_url: string;
}

/** Loose GitHub release shape shared by updater + streamdeck plugin resolve. */
export interface GithubRelease {
	tag_name?: string;
	name?: string | null;
	body?: string | null;
	published_at?: string | null;
	html_url?: string;
	draft?: boolean;
	prerelease?: boolean;
	assets?: GithubReleaseAsset[];
}

/** Shared GitHub repo API client (`apiRepoUrl` as baseURL). */
export const githubRepoFetch = createFetch({
	baseURL: apiRepoUrl,
	throw: false as const,
	headers: {
		Accept: "application/vnd.github+json",
		"User-Agent": "ytmdesktop2",
	},
	auth: {
		type: "Bearer",
		token: () => process.env.GITHUB_TOKEN,
	},
});
