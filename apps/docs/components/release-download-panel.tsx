"use client";

import { type ComponentProps, useEffect, useMemo, useState } from "react";
import { ArrowUpRightIcon, ChevronDownIcon, DownloadIcon } from "lucide-react";
import { buttonVariants } from "fumadocs-ui/components/ui/button";
import { cn } from "@/lib/cn";
import {
  type CpuArch,
  type DownloadPlatform,
  type LatestRelease,
  type ReleaseAsset,
  type ReleaseChannel,
  DOWNLOAD_PLATFORMS,
  RELEASE_CHANNEL_LABELS,
  formatBytes,
  formatReleaseDate,
  getDownloadLabel,
  getReleaseNotes,
  getReleasesUrl,
  groupDownloadsByPlatform,
  listVisibleReleaseChannels,
  pickPreferredDownload,
  releaseTitle,
} from "@/lib/downloads";

function detectPlatform(): DownloadPlatform {
  if (typeof navigator === "undefined") {
    return "windows";
  }

  const uaData = (
    navigator as Navigator & {
      userAgentData?: { platform?: string; architecture?: string };
    }
  ).userAgentData;
  const platform = uaData?.platform?.toLowerCase();
  if (platform) {
    if (platform.includes("mac")) return "macos";
    if (platform.includes("linux")) return "linux";
    if (platform.includes("win")) return "windows";
  }

  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("mac")) return "macos";
  if (ua.includes("linux") || ua.includes("x11")) return "linux";
  return "windows";
}

function detectCpuArch(): CpuArch {
  if (typeof navigator === "undefined") {
    return "unknown";
  }

  const uaData = (
    navigator as Navigator & {
      userAgentData?: { architecture?: string };
    }
  ).userAgentData;
  const arch = uaData?.architecture?.toLowerCase();
  if (arch) {
    if (arch.includes("arm")) return "arm64";
    if (arch.includes("x86") || arch.includes("x64")) return "x64";
  }

  // Safari / older Chromium: sniff UA (best-effort).
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("arm64") || ua.includes("aarch64")) return "arm64";
  // Apple Silicon Macs still report MacIntel in many browsers — prefer arm64 for macOS.
  if (
    navigator.platform === "MacIntel" &&
    (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints
  ) {
    return "arm64";
  }
  if (ua.includes("mac")) return "arm64";
  return "unknown";
}

/** macOS trusts detection; elsewhere only arm64 is detectable, so default to x64 instead of the first asset. */
function preferredArch(platform: DownloadPlatform, arch: CpuArch): CpuArch {
  if (platform === "macos") return arch;
  return arch === "arm64" ? "arm64" : "x64";
}

function pickDefaultChannel(
  releases: Partial<Record<ReleaseChannel, LatestRelease | null>>,
): ReleaseChannel {
  return listVisibleReleaseChannels(releases)[0] ?? "stable";
}

interface ReleaseDownloadPanelProps {
  releases: Partial<Record<ReleaseChannel, LatestRelease | null>>;
}

export function ReleaseDownloadPanel({ releases }: ReleaseDownloadPanelProps) {
  const [platform, setPlatform] = useState<DownloadPlatform>("windows");
  const [cpuArch, setCpuArch] = useState<CpuArch>("unknown");
  const [detected, setDetected] = useState<DownloadPlatform | null>(null);
  const [channel, setChannel] = useState<ReleaseChannel>(() => pickDefaultChannel(releases));

  useEffect(() => {
    const system = detectPlatform();
    setPlatform(system);
    setCpuArch(detectCpuArch());
    setDetected(system);
  }, []);

  const availableChannels = useMemo(() => listVisibleReleaseChannels(releases), [releases]);

  useEffect(() => {
    if (!availableChannels.includes(channel)) {
      setChannel(availableChannels[0] ?? "stable");
    }
  }, [availableChannels, channel]);

  const release = releases[channel] ?? null;
  const groups = useMemo(
    () => (release ? groupDownloadsByPlatform(release.assets) : null),
    [release],
  );

  if (!release || !groups) {
    return (
      <aside className="relative rounded-2xl border bg-fd-card p-6">
        <p className="text-sm font-medium text-fd-muted-foreground">Latest release</p>
        <h2 className="mt-4 text-xl font-semibold tracking-tight">Release feed unavailable</h2>
        <p className="mt-2 text-sm text-fd-muted-foreground">
          Open GitHub Releases for Windows, macOS, and Linux builds.
        </p>
        <a
          href={getReleasesUrl()}
          target="_blank"
          rel="noreferrer"
          className={cn(buttonVariants({ variant: "secondary" }), "mt-5 gap-2 px-4 py-2")}
        >
          Browse releases
          <ArrowUpRightIcon className="size-4" />
        </a>
      </aside>
    );
  }

  const notes = getReleaseNotes(release.body, null);
  const assets = groups[platform];
  const primary = pickPreferredDownload(assets, preferredArch(platform, cpuArch));
  const others = assets.filter((asset) => asset !== primary);
  const platformLabel = DOWNLOAD_PLATFORMS.find((item) => item.id === platform)?.label;
  const isSystem = detected === platform;
  const primaryLabel = primary ? getDownloadLabel(primary) : null;

  return (
    <aside className="overflow-hidden rounded-2xl border bg-fd-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-fd-border px-5 py-3">
        {availableChannels.length > 1 ? (
          <div role="radiogroup" aria-label="Release channel" className="-ml-1 flex gap-0.5">
            {availableChannels.map((item) => (
              <button
                key={item}
                type="button"
                role="radio"
                aria-checked={item === channel}
                onClick={() => setChannel(item)}
                className={cn(
                  "cursor-pointer rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                  item === channel
                    ? "bg-fd-secondary text-fd-foreground"
                    : "text-fd-muted-foreground hover:text-fd-foreground",
                )}
              >
                {RELEASE_CHANNEL_LABELS[item]}
              </button>
            ))}
          </div>
        ) : (
          <span className="text-xs font-medium text-fd-muted-foreground">
            {RELEASE_CHANNEL_LABELS[channel]}
          </span>
        )}
        <span className="font-mono text-xs text-fd-muted-foreground tabular-nums">
          {release.tag_name} · {formatReleaseDate(release.published_at)}
        </span>
      </div>

      <div className="p-5">
        <h2 className="text-lg font-semibold tracking-tight text-balance">
          {releaseTitle(release)}
        </h2>

        <div
          role="tablist"
          aria-label="Download platform"
          className="mt-5 flex border-b border-fd-border"
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
                  "-mb-px inline-flex cursor-pointer items-center gap-1.5 border-b-2 px-3 pb-2 text-sm font-medium transition-colors",
                  selected
                    ? "border-fd-primary text-fd-foreground"
                    : "border-transparent text-fd-muted-foreground hover:text-fd-foreground",
                  count === 0 && !selected && "opacity-60",
                )}
              >
                {item.label}
                {detected === item.id ? (
                  <>
                    <span className="size-1.5 rounded-full bg-fd-primary" aria-hidden="true" />
                    <span className="sr-only">(your system)</span>
                  </>
                ) : null}
              </button>
            );
          })}
        </div>

        {primary ? (
          <>
            <a
              href={primary.browser_download_url}
              className="group mt-4 flex items-center gap-4 rounded-xl bg-fd-primary px-4 py-3 text-fd-primary-foreground transition-[filter] hover:brightness-110"
            >
              <DownloadIcon className="size-5 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">Download for {platformLabel}</span>
                <span className="block truncate text-xs opacity-80">
                  {primaryLabel?.title} · {primaryLabel?.description}
                  {isSystem ? " · recommended for your system" : ""}
                </span>
              </span>
              <span className="shrink-0 font-mono text-xs tabular-nums opacity-80">
                {formatBytes(primary.size)}
              </span>
            </a>
            {others.length > 0 ? (
              <ul className="mt-3 divide-y divide-fd-border">
                {others.map((asset) => (
                  <DownloadRow key={asset.name} asset={asset} />
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          <div className="mt-4 rounded-xl bg-fd-secondary px-4 py-4 text-sm">
            <p className="font-medium">No {platformLabel} build in this release yet</p>
            <p className="mt-1 text-pretty text-fd-muted-foreground">
              It shows up here once an installer is published to GitHub Releases.
            </p>
          </div>
        )}
      </div>

      <div className="border-t border-fd-border">
        {notes.length > 0 ? (
          // Open by default so the latest release notes are visible without a click.
          <details open className="group/notes">
            <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
              What&apos;s new
              <span className="flex items-center gap-2 text-xs font-normal text-fd-muted-foreground">
                {notes.length} {notes.length === 1 ? "change" : "changes"}
                <ChevronDownIcon className="size-3.5 transition-transform group-open/notes:rotate-180" />
              </span>
            </summary>
            <ul className="max-h-60 list-disc space-y-1.5 overflow-y-auto px-5 pb-4 pl-9 text-sm text-fd-muted-foreground">
              {notes.map((note, index) => (
                <li key={`${index}-${note}`} className="text-pretty">
                  {note}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        <a
          href={release.html_url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between border-t border-fd-border px-5 py-3 text-sm text-fd-muted-foreground transition-colors first:border-t-0 hover:text-fd-foreground"
        >
          View release on GitHub
          <ArrowUpRightIcon className="size-3.5" />
        </a>
      </div>
    </aside>
  );
}

function DownloadRow({ asset }: { asset: ReleaseAsset }) {
  const label = getDownloadLabel(asset);

  return (
    <li>
      <a href={asset.browser_download_url} className="group flex items-center gap-3 py-2.5 text-sm">
        <span className="min-w-0 flex-1">
          <span className="block font-medium transition-colors group-hover:text-fd-primary">
            {label.title}
          </span>
          <span className="block truncate text-xs text-fd-muted-foreground">
            {label.description}
          </span>
        </span>
        <span className="shrink-0 font-mono text-xs text-fd-muted-foreground tabular-nums">
          {formatBytes(asset.size)}
        </span>
        <DownloadIcon className="size-4 shrink-0 text-fd-muted-foreground transition-colors group-hover:text-fd-primary" />
      </a>
    </li>
  );
}

/** Hero CTA: server renders the generic link, the client swaps in the visitor's platform build. */
export function HeroDownloadButton({
  release,
  fallbackUrl,
  short,
  ...props
}: { release: LatestRelease | null; fallbackUrl: string; short?: boolean } & ComponentProps<"a">) {
  const [pick, setPick] = useState<{ url: string; label: string } | null>(null);

  useEffect(() => {
    if (!release) return;
    const platform = detectPlatform();
    const asset = pickPreferredDownload(
      groupDownloadsByPlatform(release.assets)[platform],
      preferredArch(platform, detectCpuArch()),
    );
    const label = DOWNLOAD_PLATFORMS.find((item) => item.id === platform)?.label;
    if (asset && label) setPick({ url: asset.browser_download_url, label });
  }, [release]);

  return (
    <a {...props} href={pick?.url ?? fallbackUrl}>
      <DownloadIcon className={short ? "size-3.5" : "size-4"} />
      {short
        ? "Download"
        : pick
          ? `Download for ${pick.label}`
          : release
            ? `Download ${release.tag_name}`
            : "Download latest"}
    </a>
  );
}
