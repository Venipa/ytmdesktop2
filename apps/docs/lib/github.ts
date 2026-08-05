import {
  type LatestRelease,
  type ReleaseAsset,
  getLatestReleaseUrl,
  getRepositoryUrl,
  getReleasesUrl,
  groupDownloadsByPlatform,
  listUserDownloads,
  pickPrimaryDownload,
} from './downloads';
import { repoBranch, repoName, repoOwner } from './shared';

export type {
  DownloadKind,
  DownloadLabel,
  DownloadPlatform,
  LatestRelease,
  ReleaseAsset,
} from './downloads';

export {
  formatBytes,
  formatReleaseDate,
  getDownloadLabel,
  getLatestReleaseUrl,
  getReleaseNotes,
  getRepositoryUrl,
  getReleasesUrl,
  groupDownloadsByPlatform,
  listUserDownloads,
  pickPrimaryDownload,
} from './downloads';

interface GitHubReleaseResponse {
  tag_name: string;
  name: string | null;
  html_url: string;
  published_at: string;
  body: string | null;
  prerelease: boolean;
  draft: boolean;
  assets: Array<{
    name: string;
    browser_download_url: string;
    size: number;
    content_type: string;
  }>;
}

function mapRelease(data: GitHubReleaseResponse): LatestRelease {
  return {
    tag_name: data.tag_name,
    name: data.name ?? data.tag_name,
    html_url: data.html_url,
    published_at: data.published_at,
    body: data.body,
    prerelease: data.prerelease,
    draft: data.draft,
    assets: data.assets.map((asset) => ({
      name: asset.name,
      browser_download_url: asset.browser_download_url,
      size: asset.size,
      content_type: asset.content_type,
    })),
  };
}

function githubHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': `${repoName}-docs`,
  };
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export function getBlobUrl(path: string): string {
  const normalized = path.replace(/^\/+/, '');
  return `${getRepositoryUrl()}/blob/${repoBranch}/${normalized}`;
}

export function getTreeUrl(path: string): string {
  const normalized = path.replace(/^\/+/, '');
  return `${getRepositoryUrl()}/tree/${repoBranch}/${normalized}`;
}

export async function getLatestRelease(): Promise<LatestRelease | null> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/releases/latest`,
      {
        headers: githubHeaders(),
        next: { revalidate: 3600 },
      },
    );

    if (!response.ok) {
      return null;
    }

    return mapRelease((await response.json()) as GitHubReleaseResponse);
  } catch {
    return null;
  }
}

/** Fetch published releases (skips drafts). Paginated. */
export async function listReleases(options?: {
  maxPages?: number;
  includePrereleases?: boolean;
}): Promise<LatestRelease[]> {
  const maxPages = options?.maxPages ?? 10;
  const includePrereleases = options?.includePrereleases ?? true;
  const releases: LatestRelease[] = [];

  try {
    for (let page = 1; page <= maxPages; page += 1) {
      const response = await fetch(
        `https://api.github.com/repos/${repoOwner}/${repoName}/releases?per_page=30&page=${page}`,
        {
          headers: githubHeaders(),
          next: { revalidate: 3600 },
        },
      );

      if (!response.ok) {
        break;
      }

      const batch = (await response.json()) as GitHubReleaseResponse[];
      if (batch.length === 0) {
        break;
      }

      for (const item of batch) {
        if (item.draft) continue;
        if (!includePrereleases && item.prerelease) continue;
        releases.push(mapRelease(item));
      }

      if (batch.length < 30) {
        break;
      }
    }
  } catch {
    return releases;
  }

  return releases;
}
