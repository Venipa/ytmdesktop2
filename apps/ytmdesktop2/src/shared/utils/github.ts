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
