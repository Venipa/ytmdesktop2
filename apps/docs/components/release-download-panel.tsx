'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRightIcon, ChevronDownIcon, DownloadIcon } from 'lucide-react';
import { buttonVariants } from 'fumadocs-ui/components/ui/button';
import { cn } from '@/lib/cn';
import {
  type CpuArch,
  type DownloadPlatform,
  type LatestRelease,
  type ReleaseAsset,
  type ReleaseChannel,
  DOWNLOAD_PLATFORMS,
  RELEASE_CHANNELS,
  RELEASE_CHANNEL_LABELS,
  formatBytes,
  formatReleaseDate,
  getDownloadLabel,
  getReleaseNotes,
  getReleasesUrl,
  groupDownloadsByPlatform,
  pickPreferredDownload,
} from '@/lib/downloads';

function detectPlatform(): DownloadPlatform {
  if (typeof navigator === 'undefined') {
    return 'windows';
  }

  const uaData = (
    navigator as Navigator & {
      userAgentData?: { platform?: string; architecture?: string };
    }
  ).userAgentData;
  const platform = uaData?.platform?.toLowerCase();
  if (platform) {
    if (platform.includes('mac')) return 'macos';
    if (platform.includes('linux')) return 'linux';
    if (platform.includes('win')) return 'windows';
  }

  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('mac')) return 'macos';
  if (ua.includes('linux') || ua.includes('x11')) return 'linux';
  return 'windows';
}

function detectCpuArch(): CpuArch {
  if (typeof navigator === 'undefined') {
    return 'unknown';
  }

  const uaData = (
    navigator as Navigator & {
      userAgentData?: { architecture?: string };
    }
  ).userAgentData;
  const arch = uaData?.architecture?.toLowerCase();
  if (arch) {
    if (arch.includes('arm')) return 'arm64';
    if (arch.includes('x86') || arch.includes('x64')) return 'x64';
  }

  // Safari / older Chromium: sniff UA (best-effort).
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('arm64') || ua.includes('aarch64')) return 'arm64';
  // Apple Silicon Macs still report MacIntel in many browsers — prefer arm64 for macOS.
  if (navigator.platform === 'MacIntel' && (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints) {
    return 'arm64';
  }
  if (ua.includes('mac')) return 'arm64';
  return 'unknown';
}

function pickDefaultChannel(
  releases: Partial<Record<ReleaseChannel, LatestRelease | null>>,
): ReleaseChannel {
  for (const channel of RELEASE_CHANNELS) {
    if (releases[channel]) return channel;
  }
  return 'stable';
}

interface ReleaseDownloadPanelProps {
  releases: Partial<Record<ReleaseChannel, LatestRelease | null>>;
}

export function ReleaseDownloadPanel({ releases }: ReleaseDownloadPanelProps) {
  const [platform, setPlatform] = useState<DownloadPlatform>('windows');
  const [cpuArch, setCpuArch] = useState<CpuArch>('unknown');
  const [detected, setDetected] = useState(false);
  const [channel, setChannel] = useState<ReleaseChannel>(() => pickDefaultChannel(releases));
  const [channelOpen, setChannelOpen] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const channelMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPlatform(detectPlatform());
    setCpuArch(detectCpuArch());
    setDetected(true);
  }, []);

  useEffect(() => {
    if (!releases[channel]) {
      setChannel(pickDefaultChannel(releases));
    }
  }, [releases, channel]);

  useEffect(() => {
    setNotesExpanded(false);
  }, [channel]);

  useEffect(() => {
    if (!channelOpen) return;

    function onPointerDown(event: MouseEvent) {
      if (!channelMenuRef.current?.contains(event.target as Node)) {
        setChannelOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setChannelOpen(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [channelOpen]);

  const availableChannels = useMemo(
    () => RELEASE_CHANNELS.filter((item) => Boolean(releases[item])),
    [releases],
  );

  const release = releases[channel] ?? null;
  const groups = useMemo(
    () => (release ? groupDownloadsByPlatform(release.assets) : null),
    [release],
  );

  if (!release || !groups) {
    return (
      <aside className="relative rounded-2xl border bg-fd-background/85 p-6 backdrop-blur-md">
        <p className="text-sm font-medium text-fd-muted-foreground">Latest release</p>
        <h2 className="mt-4 text-xl font-semibold tracking-tight">Release feed unavailable</h2>
        <p className="mt-2 text-sm text-fd-muted-foreground">
          Open GitHub Releases for Windows, macOS, and Linux builds.
        </p>
        <a
          href={getReleasesUrl()}
          target="_blank"
          rel="noreferrer"
          className={cn(buttonVariants({ variant: 'secondary' }), 'mt-5 gap-2 px-4 py-2')}
        >
          Browse releases
          <ArrowUpRightIcon className="size-4" />
        </a>
      </aside>
    );
  }

  const notes = getReleaseNotes(release.body, null);
  const assets = groups[platform];
  const primary = pickPreferredDownload(assets, platform === 'macos' ? cpuArch : null);
  const platformLabel = DOWNLOAD_PLATFORMS.find((item) => item.id === platform)?.label;

  return (
    <aside className="relative rounded-2xl border bg-fd-background/85 p-6 backdrop-blur-md">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="relative" ref={channelMenuRef}>
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={channelOpen}
            onClick={() => setChannelOpen((open) => !open)}
            className="inline-flex items-center gap-1 text-sm font-medium text-fd-muted-foreground transition-colors hover:text-fd-foreground"
          >
            Latest release
            <ChevronDownIcon
              className={cn('size-3.5 transition-transform', channelOpen && 'rotate-180')}
            />
          </button>
          {channelOpen ? (
            <ul
              role="listbox"
              aria-label="Release channel"
              className="absolute left-0 top-full z-20 mt-1.5 min-w-40 overflow-hidden rounded-xl border bg-fd-popover py-1 shadow-lg"
            >
              {availableChannels.map((item) => {
                const itemRelease = releases[item];
                const selected = item === channel;
                return (
                  <li key={item} role="option" aria-selected={selected}>
                    <button
                      type="button"
                      onClick={() => {
                        setChannel(item);
                        setChannelOpen(false);
                      }}
                      className={cn(
                        'flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm transition-colors hover:bg-fd-accent',
                        selected && 'bg-fd-accent/60',
                      )}
                    >
                      <span className="font-medium text-fd-foreground">
                        {RELEASE_CHANNEL_LABELS[item]}
                      </span>
                      {itemRelease ? (
                        <span className="text-xs text-fd-muted-foreground">
                          {itemRelease.tag_name}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
        <span className="rounded-full border bg-fd-secondary px-2.5 py-1 text-xs font-medium">
          {release.tag_name}
        </span>
      </div>

      <h2 className="text-xl font-semibold tracking-tight">{release.name}</h2>
      <p className="mt-1 text-sm text-fd-muted-foreground">
        Published {formatReleaseDate(release.published_at)}
        {channel !== 'stable' ? ` · ${RELEASE_CHANNEL_LABELS[channel]}` : ''}
      </p>

      {notes.length > 0 ? (
        <ReleaseNotesCollapse
          notes={notes}
          expanded={notesExpanded}
          onToggle={() => setNotesExpanded((value) => !value)}
        />
      ) : null}

      <div
        role="tablist"
        aria-label="Download platform"
        className="mt-5 flex flex-wrap gap-1 rounded-xl border bg-fd-secondary/40 p-1"
      >
        {DOWNLOAD_PLATFORMS.map((item) => {
          const selected = platform === item.id;
          const count = groups[item.id].length;

          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setPlatform(item.id)}
              className={cn(
                'flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                selected
                  ? 'bg-fd-background text-fd-foreground shadow-sm'
                  : 'text-fd-muted-foreground hover:text-fd-foreground',
              )}
            >
              {item.label}
              {count === 0 ? (
                <span className="ml-1 text-[10px] font-normal opacity-70">soon</span>
              ) : null}
            </button>
          );
        })}
      </div>

      {detected ? (
        <p className="mt-2 text-xs text-fd-muted-foreground">
          Pre-selected for your system ({platformLabel}
          {platform === 'macos' && cpuArch === 'arm64' ? ', Apple Silicon' : ''}
          {platform === 'macos' && cpuArch === 'x64' ? ', Intel' : ''}).
        </p>
      ) : null}

      {primary ? (
        <>
          <a
            href={primary.browser_download_url}
            className={cn(buttonVariants({ variant: 'primary' }), 'mt-4 w-full gap-2 px-4 py-2')}
          >
            <DownloadIcon className="size-4" />
            Download for {platformLabel}
          </a>
          <ul className="mt-4 space-y-2">
            {assets.map((asset) => (
              <DownloadRow key={asset.name} asset={asset} />
            ))}
          </ul>
        </>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed bg-fd-secondary/30 px-4 py-5 text-sm text-fd-muted-foreground">
          <p className="font-medium text-fd-foreground">{platformLabel} builds not in this release yet</p>
          <p className="mt-1.5 text-pretty">
            When a {platformLabel} installer is published to GitHub Releases, it shows up here
            automatically.
          </p>
          <a
            href={release.html_url}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-fd-primary hover:underline"
          >
            Check release assets
            <ArrowUpRightIcon className="size-3.5" />
          </a>
        </div>
      )}

      <a
        href={release.html_url}
        target="_blank"
        rel="noreferrer"
        className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-fd-primary hover:underline"
      >
        View on GitHub
        <ArrowUpRightIcon className="size-3.5" />
      </a>
    </aside>
  );
}

interface ReleaseNotesCollapseProps {
  notes: string[];
  expanded: boolean;
  onToggle: () => void;
}

function ReleaseNotesCollapse({ notes, expanded, onToggle }: ReleaseNotesCollapseProps) {
  const measureRef = useRef<HTMLUListElement>(null);
  const [needsCollapse, setNeedsCollapse] = useState(() => notes.length > 2);

  useEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    // Collapsed viewport is max-h-20 (5rem)
    setNeedsCollapse(el.scrollHeight > 80);
  }, [notes]);

  const list = (
    <ul
      ref={measureRef}
      className={cn(
        'list-disc space-y-1.5 pl-4 text-sm text-fd-muted-foreground',
        expanded && needsCollapse && 'max-h-[min(32rem,70vh)] overflow-y-auto pr-1',
      )}
    >
      {notes.map((note) => (
        <li key={note} className="text-pretty">
          {note}
        </li>
      ))}
    </ul>
  );

  if (!needsCollapse) {
    return <div className="mt-4">{list}</div>;
  }

  if (expanded) {
    return (
      <div className="mt-4">
        <div className="max-h-[min(32rem,70vh)] overflow-hidden transition-[max-height] duration-300 ease-out">
          {list}
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="mt-2 text-xs font-medium text-fd-primary transition-colors hover:text-fd-foreground"
        >
          Collapse
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={false}
      className="relative mt-4 block w-full max-h-20 overflow-hidden text-left transition-[max-height] duration-300 ease-out"
    >
      {list}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 flex h-14 items-end justify-center bg-linear-to-t from-fd-background via-fd-background/90 to-transparent pb-1">
        <span className="text-xs font-medium text-fd-primary">Expand</span>
      </span>
    </button>
  );
}

function DownloadRow({ asset }: { asset: ReleaseAsset }) {
  const label = getDownloadLabel(asset);

  return (
    <li>
      <a
        href={asset.browser_download_url}
        className="group flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors hover:bg-fd-accent"
      >
        <span className="min-w-0">
          <span className="block font-medium">{label.title}</span>
          <span className="block truncate text-xs text-fd-muted-foreground">
            {label.description}
          </span>
        </span>
        <span className="shrink-0 text-xs text-fd-muted-foreground">{formatBytes(asset.size)}</span>
      </a>
    </li>
  );
}
