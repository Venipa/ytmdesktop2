function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : undefined;
}

function parseRepoUrl(url: string): { owner: string; name: string } | null {
  try {
    const pathname = new URL(url).pathname.replace(/^\/+|\/+$/g, '');
    const [owner, name] = pathname.split('/');
    if (!owner || !name) return null;
    return { owner, name };
  } catch {
    return null;
  }
}

const parsedFromUrl = (() => {
  const url = readEnv('REPO_URL') ?? readEnv('NEXT_PUBLIC_REPO_URL');
  return url ? parseRepoUrl(url) : null;
})();

const githubRepository = readEnv('GITHUB_REPOSITORY');
const githubParts = githubRepository?.includes('/')
  ? {
      owner: githubRepository.split('/')[0]!,
      name: githubRepository.split('/')[1]!,
    }
  : null;

export const repoOwner =
  readEnv('REPO_OWNER') ??
  readEnv('NEXT_PUBLIC_REPO_OWNER') ??
  parsedFromUrl?.owner ??
  githubParts?.owner ??
  'local';

export const repoName =
  readEnv('REPO_NAME') ??
  readEnv('NEXT_PUBLIC_REPO_NAME') ??
  parsedFromUrl?.name ??
  githubParts?.name ??
  'app';

export const repoTitle =
  readEnv('REPO_TITLE') ??
  readEnv('NEXT_PUBLIC_REPO_TITLE') ??
  repoName;

export const repoUrl =
  readEnv('REPO_URL') ??
  readEnv('NEXT_PUBLIC_REPO_URL') ??
  `https://github.com/${repoOwner}/${repoName}`;

export const repoBranch =
  readEnv('REPO_BRANCH') ??
  readEnv('NEXT_PUBLIC_REPO_BRANCH') ??
  readEnv('GITHUB_REF_NAME') ??
  'master';

/** GitHub stargazer count baked in at build time (CI sets `REPO_STARS`). */
export const repoStars = (() => {
  const raw = readEnv('REPO_STARS') ?? readEnv('NEXT_PUBLIC_REPO_STARS');
  if (!raw) return null;
  const count = Number.parseInt(raw, 10);
  return Number.isFinite(count) && count >= 0 ? count : null;
})();

/** Compact star label, e.g. `128` or `1.2k`. */
export function formatStarCount(count: number): string {
  if (count < 1000) return String(count);
  const compact = count / 1000;
  const rounded = compact >= 10 ? Math.round(compact) : Math.round(compact * 10) / 10;
  return `${rounded}k`;
}

/** Display name in nav / metadata (same as REPO_TITLE). */
export const appName = repoTitle;

export const docsRoute = '/docs';
export const docsImageRoute = '/og/docs';
export const docsContentRoute = '/llms.mdx/docs';
export const changelogRoute = '/changelog';

export const siteUrl =
  readEnv('NEXT_PUBLIC_URL') ??
  `https://${repoOwner.toLowerCase()}.github.io/${repoName}`;

export const brandColor = '#8B1CC3';
export const brandColorRgb = '139, 28, 195';

export const appTagline = 'YouTube Music, on your desktop';
export const appDescription =
  'A beautiful YouTube Music desktop app with Last.fm, Discord RPC, tray view, themes, DPI-aware scaling, mini player, OBS overlays, and Stream Deck.';

export const docsDescription = `Documentation for ${appName} — features, install, API, Stream Deck, and changelog.`;

export const discordUrl =
  readEnv('DISCORD_URL') ??
  readEnv('NEXT_PUBLIC_DISCORD_URL') ??
  'https://discord.gg/dq4bZMhMjT';

/** @deprecated use repoOwner / repoName / repoBranch */
export const gitConfig = {
  user: repoOwner,
  repo: repoName,
  branch: repoBranch,
};

export const socials = {
  discord: {
    handle: 'Discord',
    url: discordUrl,
  },
  github: {
    handle: repoOwner,
    url: `https://github.com/${repoOwner}`,
  },
} as const;
