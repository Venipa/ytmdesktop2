import { HeroShot, Parallax, SurfaceWalkthrough } from "@/components/app-preview";
import { JsonLd } from "@/components/json-ld";
import { RevealBlock, Settle } from "@/components/landing-motion";
import { HeroDownloadButton, ReleaseDownloadPanel } from "@/components/release-download-panel";
import { cn } from "@/lib/cn";
import {
  getLatestReleasesByChannel,
  getLatestReleaseUrl,
  getRepositoryUrl,
  groupDownloadsByPlatform,
  pickPrimaryDownload,
} from "@/lib/github";
import { assetPath } from "@/lib/paths";
import { absolutePageUrl, homeJsonLd } from "@/lib/seo";
import {
  appDescription,
  appName,
  appTagline,
  changelogRoute,
  docsRoute,
  formatStarCount,
  HERO_DOWNLOAD_ID,
  repoStars,
} from "@/lib/shared";
import { buttonVariants } from "fumadocs-ui/components/ui/button";
import { BookOpenIcon, HammerIcon, PackageIcon, ScrollTextIcon, StarIcon } from "lucide-react";
import Image from "next/image";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { alternates: { canonical: absolutePageUrl("/") } };

const features = [
  {
    title: "Tray view",
    wide: true,
    description: "Quick now-playing popup anchored to the system tray.",
    href: `${docsRoute}/features/tray-view/`,
    image: "/images/features-trayview.png",
  },
  {
    title: "Discord",
    description: "Show friends what you are listening to.",
    href: `${docsRoute}/features/discord/`,
    image: "/images/features-rpc2.png",
  },
  {
    title: "Stream Deck",
    description: "Playback controls on Elgato hardware.",
    href: `${docsRoute}/integrations/streamdeck/`,
    image: "/images/bg-7.jpg",
  },
  {
    title: "Themes",
    wide: true,
    description: "Bundled or custom styles, thumbnail background, and glass blur.",
    href: `${docsRoute}/features/themes/`,
    image: "/images/player-full-2.png",
  },
  {
    title: "Display zoom",
    description: "Scale YouTube Music from 80% to 150%.",
    href: `${docsRoute}/features/display/`,
    image: "/images/player-full.png",
  },
  {
    title: "DPI & scaling",
    description: "High-DPI chrome with OS display scale.",
    href: `${docsRoute}/features/dpi/`,
    image: "/images/bg-4.jpg",
  },
  {
    title: "Synced lyrics",
    wide: true,
    description: "Timed lyrics via Better Lyrics, Unison, and LRCLib.",
    href: `${docsRoute}/features/lyrics/`,
    image: "/images/features-lyrics-player.png",
  },
  {
    title: "OBS overlays",
    wide: true,
    description: "Browser sources from the local API.",
    href: `${docsRoute}/features/obs/`,
    image: "/images/bg-5.jpg",
  },
  {
    title: "Local API",
    description: "HTTP endpoints for automation.",
    href: `${docsRoute}/api/`,
    image: "/images/bg-6.jpg",
  },
  {
    title: "Last.fm",
    description: "Scrobble tracks and sync Now Playing.",
    href: `${docsRoute}/features/lastfm/`,
    image: "/images/feature-lastfm.jpg",
  },
  {
    title: "Changelog",
    wide: true,
    description: "Published GitHub releases and notes.",
    href: changelogRoute,
    image: "/images/bg-8.jpg",
  },
] as const;

export default async function HomePage() {
  const releases = await getLatestReleasesByChannel();
  const release = releases.stable ?? releases.beta ?? releases.alpha;
  const groups = release ? groupDownloadsByPlatform(release.assets) : null;
  const anyAsset =
    (groups && (groups.windows[0] ?? groups.macos[0] ?? groups.linux[0])) ||
    (release ? pickPrimaryDownload(release.assets) : undefined);
  const downloadUrl = anyAsset?.browser_download_url ?? getLatestReleaseUrl();

  const secondary = cn(
    buttonVariants({ variant: "ghost" }),
    "gap-2 px-4 py-2 text-fd-muted-foreground hover:text-fd-foreground",
  );

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-28 px-4 pt-16 pb-24 md:gap-40 md:pt-24">
      <JsonLd data={homeJsonLd()} />
      <section className="flex flex-col items-center text-center">
        <Settle className="flex flex-col items-center">
          <div className="mb-8 inline-flex items-center gap-3">
            <Image
              src={assetPath("/logo.png")}
              alt=""
              width={40}
              height={40}
              className="size-10 shrink-0 rounded-xl"
              priority
            />
            <span className="text-xl font-semibold tracking-tight">{appName}</span>
          </div>
          <h1 className="max-w-3xl text-5xl font-semibold tracking-[-0.035em] text-balance md:text-7xl">
            {appTagline}
          </h1>
          <p className="mt-6 max-w-xl text-base text-pretty text-fd-muted-foreground md:text-lg">
            {appDescription}
          </p>
        </Settle>
        <Settle delay={0.1} className="mt-10 flex flex-wrap items-center justify-center gap-2">
          <HeroDownloadButton
            id={HERO_DOWNLOAD_ID}
            release={release ?? null}
            fallbackUrl={downloadUrl}
            className={cn(buttonVariants({ variant: "primary" }), "gap-2 px-5 py-2.5")}
          />
          <Link href={docsRoute} className={secondary}>
            <BookOpenIcon className="size-4" />
            Read the docs
          </Link>
        </Settle>
        <div className="mt-16 w-full md:mt-20">
          <HeroShot />
        </div>
      </section>

      <section>
        <RevealBlock className="mb-10 max-w-md lg:mb-0">
          <h2 className="text-3xl font-semibold tracking-tight text-balance md:text-4xl">
            Built for desktop listening
          </h2>
          <p className="mt-3 leading-relaxed text-pretty text-fd-muted-foreground">
            Native window chrome, tray controls, themes, and lyrics that stay out of the way while
            YouTube Music plays.
          </p>
        </RevealBlock>
        <SurfaceWalkthrough />
      </section>

      <div className="[container-type:inline-size]">
        <div className="mb-6 max-w-md">
          <h2 className="text-3xl font-semibold tracking-tight text-balance md:text-4xl">
            What it does
          </h2>
          <p className="mt-2 text-pretty text-fd-muted-foreground">
            Tray view, theming, DPI-aware scaling, overlays, and hardware controls in one desktop
            client.
          </p>
        </div>
        {/* Square cells sized from the container width; dense flow backfills gaps left by wide tiles. */}
        <RevealBlock className="grid grid-flow-row-dense grid-cols-2 gap-3 auto-rows-[calc((100cqi-0.75rem)/2)] sm:grid-cols-3 sm:auto-rows-[calc((100cqi-1.5rem)/3)] lg:grid-cols-4 lg:auto-rows-[calc((100cqi-2.25rem)/4)]">
          {features.map((feature) => {
            const wide = "wide" in feature && feature.wide;
            return (
              <Link
                key={feature.title}
                href={feature.href}
                className={cn(
                  "group relative block overflow-hidden rounded-2xl",
                  wide && "col-span-2",
                  // 3 columns: 16 cells leave a hole, so the last wide tile goes narrow there.
                  feature.title === "Changelog" && "sm:max-lg:col-span-1",
                )}
              >
                <Parallax className="absolute inset-x-0 -inset-y-[8%] block">
                  <span className="absolute inset-0 transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100">
                    <Image
                      src={assetPath(feature.image)}
                      alt=""
                      fill
                      sizes={
                        wide
                          ? "(min-width: 1024px) 560px, (min-width: 640px) 66vw, 100vw"
                          : "(min-width: 1024px) 280px, (min-width: 640px) 33vw, 50vw"
                      }
                      className="object-cover"
                    />
                  </span>
                </Parallax>
                <span
                  className="pointer-events-none absolute inset-0 bg-black/30"
                  aria-hidden="true"
                />
                <span className="pointer-events-none absolute inset-x-0 bottom-0 flex h-[72%] flex-col justify-end bg-[linear-gradient(to_top,rgb(0_0_0/0.92)_0%,rgb(0_0_0/0.72)_18%,rgb(0_0_0/0.38)_46%,rgb(0_0_0/0.12)_72%,transparent_100%)] px-4 pb-4">
                  <span className="block font-medium tracking-tight text-white">
                    {feature.title}
                  </span>
                  <span className="mt-1 block text-sm leading-snug text-pretty text-white/80">
                    {feature.description}
                  </span>
                </span>
              </Link>
            );
          })}
        </RevealBlock>
      </div>

      <section
        id="download"
        className="scroll-mt-24 grid items-start gap-10 border-t border-fd-border pt-16 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16"
      >
        <RevealBlock className="max-w-md">
          <h2 className="text-3xl font-semibold tracking-tight text-balance md:text-4xl">
            Free, on every desktop
          </h2>
          <p className="mt-3 leading-relaxed text-pretty text-fd-muted-foreground">
            Windows, macOS, and Linux builds for every release channel, straight from GitHub.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {repoStars != null && (
              <a
                href={getRepositoryUrl()}
                target="_blank"
                rel="noreferrer"
                className={secondary}
                aria-label={`${formatStarCount(repoStars)} stars on GitHub`}
              >
                <StarIcon className="size-4 fill-current" />
                <span className="tabular-nums">{formatStarCount(repoStars)}</span>
              </a>
            )}
            <Link href={changelogRoute} className={secondary}>
              <ScrollTextIcon className="size-4" />
              Changelog
            </Link>
            <Link href={`${docsRoute}/install/`} className={secondary}>
              <PackageIcon className="size-4" />
              Install guide
            </Link>
            <Link href={`${docsRoute}/build/`} className={secondary}>
              <HammerIcon className="size-4" />
              Build from source
            </Link>
          </div>
        </RevealBlock>
        <RevealBlock>
          <ReleaseDownloadPanel releases={releases} />
        </RevealBlock>
      </section>
    </main>
  );
}
