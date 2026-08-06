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

export type DownloadKind =
  | 'windows-setup'
  | 'macos-dmg'
  | 'macos-zip'
  | 'macos-pkg'
  | 'linux-appimage'
  | 'linux-deb'
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
  // This project's Linux artifacts are AppImage/deb — remaining arch zips are mac builds.
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

export function getReleaseNotes(body: string | null, maxItems = 6): string[] {
  if (!body) {
    return [];
  }

  return body
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
    .filter((line) => line.length > 0 && !/^changes$/i.test(line))
    .slice(0, maxItems);
}
