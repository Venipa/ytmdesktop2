import { createMDX } from 'fumadocs-mdx/next';
import { loadDocsEnv } from './scripts/load-docs-env.mjs';

loadDocsEnv();

const withMDX = createMDX();

/**
 * Derive Next.js basePath from a site URL (e.g. GitHub Pages page_url / base_url).
 * https://owner.github.io/repo/ → /repo
 * https://owner.github.io/ → ""
 */
function basePathFromSiteUrl(url) {
  if (!url) return '';
  try {
    return new URL(url).pathname.replace(/\/+$/, '');
  } catch {
    return '';
  }
}

function readEnv(name) {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : undefined;
}

function parseRepoUrl(url) {
  try {
    const pathname = new URL(url).pathname.replace(/^\/+|\/+$/g, '');
    const [owner, name] = pathname.split('/');
    if (!owner || !name) return null;
    return { owner, name };
  } catch {
    return null;
  }
}

const parsed = readEnv('REPO_URL') ? parseRepoUrl(readEnv('REPO_URL')) : null;
const githubRepository = readEnv('GITHUB_REPOSITORY');
const githubParts = githubRepository?.includes('/')
  ? {
      owner: githubRepository.split('/')[0],
      name: githubRepository.split('/')[1],
    }
  : null;

const repoOwner = readEnv('REPO_OWNER') ?? parsed?.owner ?? githubParts?.owner ?? 'local';
const repoName = readEnv('REPO_NAME') ?? parsed?.name ?? githubParts?.name ?? 'app';
const repoTitle = readEnv('REPO_TITLE') ?? repoName;
const repoUrl = readEnv('REPO_URL') ?? `https://github.com/${repoOwner}/${repoName}`;
const repoBranch = readEnv('REPO_BRANCH') ?? 'master';

const isGithubPages = process.env.GITHUB_PAGES === 'true';
if (isGithubPages && !process.env.NEXT_PUBLIC_URL) {
  process.env.NEXT_PUBLIC_URL = `https://local.pages/${repoName}`;
}

const siteUrl = process.env.NEXT_PUBLIC_URL ?? '';
const basePath = basePathFromSiteUrl(siteUrl);

/** @type {import('next').NextConfig} */
const config = {
  output: 'export',
  reactStrictMode: true,
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  ...(basePath
    ? {
        basePath,
        assetPrefix: `${basePath}/`,
      }
    : {}),
  env: {
    NEXT_PUBLIC_URL: siteUrl,
    REPO_OWNER: repoOwner,
    REPO_NAME: repoName,
    REPO_TITLE: repoTitle,
    REPO_URL: repoUrl,
    REPO_BRANCH: repoBranch,
    NEXT_PUBLIC_REPO_OWNER: repoOwner,
    NEXT_PUBLIC_REPO_NAME: repoName,
    NEXT_PUBLIC_REPO_TITLE: repoTitle,
    NEXT_PUBLIC_REPO_URL: repoUrl,
    NEXT_PUBLIC_REPO_BRANCH: repoBranch,
  },
};

export default withMDX(config);
