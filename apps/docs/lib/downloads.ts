import { repoUrl } from './shared';

export interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
  content_type: string;
}

export interface LatestRelease {
  tag_name: string;
  name: string;
  html_url: string;
  published_at: string;
  body: string | null;
  assets: ReleaseAsset[];
  prerelease?: boolean;
  draft?: boolean;
}

export type DownloadPlatform = 'windows' | 'macos' | 'linux';
export type CpuArch = 'arm64' | 'x64' | 'universal' | 'unknown';
export type ReleaseChannel = 'stable' | 'beta' | 'alpha';

export const RELEASE_CHANNELS: readonly ReleaseChannel[] = ['stable', 'beta', 'alpha'] as const;

export const RELEASE_CHANNEL_LABELS: Record<ReleaseChannel, string> = {
  stable: 'Stable',
  beta: 'Beta',
  alpha: 'Alpha',
};

interface ParsedReleaseVersion {
  major: number;
  minor: number;
  patch: number;
  /** null = stable release; otherwise prerelease id + number */
  pre: { id: 'rc' | 'a'; num: number } | null;
}

/**
 * Parse a tag/name like `v1.2.3`, `1.2.3-rc.1`, or `1.2.3-a.0`.
 */
export function parseReleaseVersion(version: string): ParsedReleaseVersion | null {
  const match = version.match(
    /(\d+)\.(\d+)\.(\d+)(?:-(rc|a|alpha)(?:\.(\d+))?)?/i,
  );
  if (!match) return null;

  const preRaw = match[4]?.toLowerCase();
  let pre: ParsedReleaseVersion['pre'] = null;
  if (preRaw === 'rc') {
    pre = { id: 'rc', num: Number(match[5] ?? 0) };
  } else if (preRaw === 'a' || preRaw === 'alpha') {
    pre = { id: 'a', num: Number(match[5] ?? 0) };
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    pre,
  };
}

/**
 * Compare two version-like tags. Negative if `left` < `right`, 0 if equal /
 * unparsable, positive if `left` > `right`. Prereleases rank below the same
 * core version (alpha < beta/rc < stable).
 */
export function compareReleaseVersions(left: string, right: string): number {
  const a = parseReleaseVersion(left);
  const b = parseReleaseVersion(right);
  if (!a || !b) return 0;

  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  if (a.patch !== b.patch) return a.patch - b.patch;

  const preRank = (pre: ParsedReleaseVersion['pre']): number => {
    if (!pre) return 2;
    if (pre.id === 'rc') return 1;
    return 0;
  };

  const rankDelta = preRank(a.pre) - preRank(b.pre);
  if (rankDelta !== 0) return rankDelta;
  if (a.pre && b.pre) return a.pre.num - b.pre.num;
  return 0;
}

/** True when `left` is a strictly older release than `right`. */
export function isReleaseOlderThan(left: string, right: string): boolean {
  return compareReleaseVersions(left, right) < 0;
}

/**
 * Channels that should appear in the download picker.
 * Hides beta when its latest tag is older than (or equal-core behind) stable.
 */
export function listVisibleReleaseChannels(
  releases: Partial<Record<ReleaseChannel, LatestRelease | null>>,
): ReleaseChannel[] {
  return RELEASE_CHANNELS.filter((channel) => {
    const release = releases[channel];
    if (!release) return false;

    if (channel === 'beta') {
      const stable = releases.stable;
      if (stable && isReleaseOlderThan(release.tag_name, stable.tag_name)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Classify a version-like string into a channel.
 * - stable: no prerelease id
 * - beta: `-rc.<n>`
 * - alpha: `-a.<n>` / `-alpha.<n>`
 */
export function getReleaseChannel(version: string): ReleaseChannel | null {
  const match = version.match(/(\d+\.\d+\.\d+)(?:-([0-9A-Za-z]+))?/);
  if (!match) return null;

  const preId = match[2]?.toLowerCase();
  if (!preId) return 'stable';
  if (preId === 'rc') return 'beta';
  if (preId === 'a' || preId === 'alpha') return 'alpha';
  return null;
}

/**
 * Resolve channel from tag, release name, and GitHub prerelease flag.
 * Handles mismatched tags (e.g. tag `v1.2.1` named `v1.2.1-rc.0`, prerelease=true).
 */
export function resolveReleaseChannel(release: {
  tag_name: string;
  name?: string | null;
  prerelease?: boolean;
}): ReleaseChannel | null {
  const fromTag = getReleaseChannel(release.tag_name);
  if (fromTag === 'beta' || fromTag === 'alpha') return fromTag;

  const fromName = release.name ? getReleaseChannel(release.name) : null;
  if (fromName === 'beta' || fromName === 'alpha') return fromName;

  // Bare tags marked prerelease on GitHub are not stable.
  if (release.prerelease) return null;
  if (fromTag === 'stable') return 'stable';
  return null;
}

export type DownloadKind =
  | 'windows-setup'
  | 'macos-dmg'
  | 'macos-zip'
  | 'macos-pkg'
  | 'linux-appimage'
  | 'linux-deb'
  | 'linux-pacman'
  | 'linux-flatpak'
  | 'other';

export interface DownloadLabel {
  kind: DownloadKind;
  platform: DownloadPlatform | null;
  arch: CpuArch;
  title: string;
  description: string;
}

export const DOWNLOAD_PLATFORMS: Array<{ id: DownloadPlatform; label: string }> = [
  { id: 'windows', label: 'Windows' },
  { id: 'macos', label: 'macOS' },
  { id: 'linux', label: 'Linux' },
];

export function getRepositoryUrl(): string {
  return repoUrl.replace(/\/+$/, '');
}

export function getReleasesUrl(): string {
  return `${getRepositoryUrl()}/releases`;
}

export function getLatestReleaseUrl(): string {
  return `${getRepositoryUrl()}/releases/latest`;
}

function detectArch(name: string): CpuArch {
  const lower = name.toLowerCase();
  if (lower.includes('universal')) return 'universal';
  if (lower.includes('arm64') || lower.includes('aarch64')) return 'arm64';
  if (lower.includes('x64') || lower.includes('x86_64') || lower.includes('amd64')) return 'x64';
  return 'unknown';
}

function archLabel(arch: CpuArch): string {
  switch (arch) {
    case 'arm64':
      return 'Apple Silicon';
    case 'x64':
      return 'Intel';
    case 'universal':
      return 'Universal';
    default:
      // electron-builder often omits arch for default x64 mac artifacts
      return 'Intel';
  }
}

/** Mac builds without an arch token are almost always the Intel (x64) artifact. */
function resolveMacArch(arch: CpuArch): CpuArch {
  return arch === 'unknown' ? 'x64' : arch;
}

/** electron-builder mac zips often look like `…-arm64.zip` / `…-x64.zip` (no "mac" token). */
function isLikelyMacZip(name: string): boolean {
  const lower = name.toLowerCase();
  if (!lower.endsWith('.zip')) return false;
  if (lower.includes('source') || lower.includes('sources')) return false;
  if (lower.includes('mac') || lower.includes('darwin') || lower.includes('osx')) return true;
  // Linux ships AppImage/deb/pacman/flatpak — remaining arch zips are mac builds.
  if (/-arm64\.zip$/.test(lower) || /-x64\.zip$/.test(lower) || /-universal\.zip$/.test(lower)) {
    return true;
  }
  return false;
}

export function getDownloadLabel(asset: ReleaseAsset): DownloadLabel {
  const name = asset.name.toLowerCase();
  const arch = detectArch(name);

  if (name.endsWith('-setup.exe') || name.endsWith('.exe')) {
    return {
      kind: 'windows-setup',
      platform: 'windows',
      arch,
      title: 'Windows installer',
      description: 'NSIS setup (.exe)',
    };
  }

  if (name.endsWith('.dmg')) {
    const macArch = resolveMacArch(arch);
    return {
      kind: 'macos-dmg',
      platform: 'macos',
      arch: macArch,
      title: 'macOS DMG',
      description: archLabel(macArch),
    };
  }

  if (name.endsWith('.pkg')) {
    const macArch = resolveMacArch(arch);
    return {
      kind: 'macos-pkg',
      platform: 'macos',
      arch: macArch,
      title: 'macOS package',
      description: archLabel(macArch),
    };
  }

  if (isLikelyMacZip(name)) {
    const macArch = resolveMacArch(arch);
    return {
      kind: 'macos-zip',
      platform: 'macos',
      arch: macArch,
      title: 'macOS zip',
      description: archLabel(macArch),
    };
  }

  if (name.endsWith('.appimage')) {
    return {
      kind: 'linux-appimage',
      platform: 'linux',
      arch,
      title: 'Linux AppImage',
      description: arch === 'arm64' ? 'arm64' : arch === 'x64' ? 'x64' : 'AppImage',
    };
  }

  if (name.endsWith('.deb')) {
    return {
      kind: 'linux-deb',
      platform: 'linux',
      arch,
      title: 'Debian package',
      description: arch === 'arm64' ? 'arm64' : '.deb',
    };
  }

  if (name.endsWith('.pkg.tar.zst') || name.endsWith('.pkg.tar.xz')) {
    return {
      kind: 'linux-pacman',
      platform: 'linux',
      arch,
      title: 'Arch package',
      description: 'Arch, CachyOS, Manjaro',
    };
  }

  if (name.endsWith('.flatpak')) {
    return {
      kind: 'linux-flatpak',
      platform: 'linux',
      arch,
      title: 'Linux Flatpak',
      description: asset.name,
    };
  }

  return {
    kind: 'other',
    platform: null,
    arch,
    title: asset.name,
    description: 'Download',
  };
}

export function listUserDownloads(assets: ReleaseAsset[]): ReleaseAsset[] {
  const order: DownloadKind[] = [
    'windows-setup',
    'macos-dmg',
    'macos-pkg',
    'macos-zip',
    'linux-appimage',
    'linux-deb',
    'linux-pacman',
    'linux-flatpak',
  ];

  return assets
    .filter((asset) => getDownloadLabel(asset).kind !== 'other')
    .sort((left, right) => {
      const leftLabel = getDownloadLabel(left);
      const rightLabel = getDownloadLabel(right);
      const kindDelta = order.indexOf(leftLabel.kind) - order.indexOf(rightLabel.kind);
      if (kindDelta !== 0) return kindDelta;
      // Prefer arm64 then universal then x64 within same kind (Apple Silicon first).
      const archOrder: CpuArch[] = ['arm64', 'universal', 'x64', 'unknown'];
      return archOrder.indexOf(leftLabel.arch) - archOrder.indexOf(rightLabel.arch);
    });
}

export function groupDownloadsByPlatform(
  assets: ReleaseAsset[],
): Record<DownloadPlatform, ReleaseAsset[]> {
  const groups: Record<DownloadPlatform, ReleaseAsset[]> = {
    windows: [],
    macos: [],
    linux: [],
  };

  for (const asset of listUserDownloads(assets)) {
    const platform = getDownloadLabel(asset).platform;
    if (platform) {
      groups[platform].push(asset);
    }
  }

  return groups;
}

/** Prefer arch-matched build when visitor CPU is known (esp. macOS arm64 vs Intel). */
export function pickPreferredDownload(
  assets: ReleaseAsset[],
  preferredArch?: CpuArch | null,
): ReleaseAsset | undefined {
  if (assets.length === 0) return undefined;
  if (!preferredArch || preferredArch === 'unknown') return assets[0];

  const exact = assets.find((asset) => getDownloadLabel(asset).arch === preferredArch);
  if (exact) return exact;

  const universal = assets.find((asset) => getDownloadLabel(asset).arch === 'universal');
  if (universal) return universal;

  return assets[0];
}

export function pickPrimaryDownload(assets: ReleaseAsset[]): ReleaseAsset | undefined {
  const groups = groupDownloadsByPlatform(assets);
  return (
    groups.windows[0] ??
    groups.macos[0] ??
    groups.linux[0] ??
    listUserDownloads(assets)[0]
  );
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ['KB', 'MB', 'GB'] as const;
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

export function formatReleaseDate(isoDate: string): string {
  return new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(isoDate));
}

export function getReleaseNotes(body: string | null, maxItems: number | null = 6): string[] {
  if (!body) {
    return [];
  }

  const notes = body
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) =>
      line
        .replace(/^#+\s*/, '')
        .replace(/^[-*+]\s+/, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/[*_`~]/g, '')
        .trim(),
    )
    .filter((line) => line.length > 0 && !/^changes$/i.test(line));

  return maxItems == null ? notes : notes.slice(0, maxItems);
}
