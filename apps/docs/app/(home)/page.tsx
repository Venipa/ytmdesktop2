import { ReleaseDownloadPanel } from '@/components/release-download-panel';
import { cn } from '@/lib/cn';
import {
  getLatestReleasesByChannel,
  getLatestReleaseUrl,
  getRepositoryUrl,
  groupDownloadsByPlatform,
  pickPrimaryDownload,
} from '@/lib/github';
import { assetPath } from '@/lib/paths';
import {
  appDescription,
  appName,
  appTagline,
  changelogRoute,
  docsRoute,
  formatStarCount,
  repoStars,
} from '@/lib/shared';
import { buttonVariants } from 'fumadocs-ui/components/ui/button';
import {
  BookOpenIcon,
  Disc3Icon,
  DownloadIcon,
  Gamepad2Icon,
  LayoutPanelTopIcon,
  MonitorIcon,
  PaletteIcon,
  RadioIcon,
  ScrollTextIcon,
  StarIcon,
  ZoomInIcon,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

const features = [
  {
    title: 'Tray view',
    description: 'Quick now-playing popup anchored to the system tray.',
    href: `${docsRoute}/features/tray-view/`,
    icon: LayoutPanelTopIcon,
    image: '/images/features-trayview.png',
    className: 'sm:col-span-2 lg:col-span-2 lg:row-span-2',
  },
  {
    title: 'Discord',
    description: 'Show friends what you are listening to.',
    href: `${docsRoute}/features/discord/`,
    icon: RadioIcon,
    image: '/images/features-rpc2.png',
    className: '',
  },
  {
    title: 'Stream Deck',
    description: 'Playback controls on Elgato hardware.',
    href: `${docsRoute}/integrations/streamdeck/`,
    icon: Gamepad2Icon,
    image: '/images/bg-7.jpg',
    className: '',
  },
  {
    title: 'Themes',
    description: 'Bundled or custom styles, thumbnail background, and glass blur.',
    href: `${docsRoute}/features/themes/`,
    icon: PaletteIcon,
    image: '/images/player-full-2.png',
    className: 'sm:col-span-2 lg:col-span-2',
  },
  {
    title: 'Display zoom',
    description: 'Scale YouTube Music from 80% to 150%.',
    href: `${docsRoute}/features/display/`,
    icon: ZoomInIcon,
    image: '/images/player-full.png',
    className: '',
  },
  {
    title: 'DPI & scaling',
    description: 'High-DPI chrome with OS display scale.',
    href: `${docsRoute}/features/dpi/`,
    icon: MonitorIcon,
    image: '/images/bg-4.jpg',
    className: '',
  },
  {
    title: 'Synced lyrics',
    description: 'Timed lyrics via Better Lyrics, Unison, and LRCLib.',
    href: `${docsRoute}/features/lyrics/`,
    icon: ScrollTextIcon,
    image: '/images/features-lyrics-player.png',
    className: '',
  },
  {
    title: 'OBS overlays',
    description: 'Browser sources from the local API.',
    href: `${docsRoute}/features/obs/`,
    icon: RadioIcon,
    image: '/images/bg-5.jpg',
    className: '',
  },
  {
    title: 'Local API',
    description: 'HTTP endpoints for automation.',
    href: `${docsRoute}/api/`,
    icon: BookOpenIcon,
    image: '/images/bg-6.jpg',
    className: '',
  },
  {
    title: 'Last.fm',
    description: 'Scrobble tracks and sync Now Playing.',
    href: `${docsRoute}/features/lastfm/`,
    icon: Disc3Icon,
    image: '/images/feature-lastfm.jpg',
    className: 'sm:col-span-2 lg:col-span-2',
  },
  {
    title: 'Changelog',
    description: 'Published GitHub releases and notes.',
    href: changelogRoute,
    icon: ScrollTextIcon,
    image: '/images/bg-8.jpg',
    className: '',
  },
] as const;

export default async function HomePage() {
  const releases = await getLatestReleasesByChannel();
  const release = releases.stable ?? releases.beta ?? releases.alpha;
  const groups = release ? groupDownloadsByPlatform(release.assets) : null;
  const anyAsset =
    (groups &&
      (groups.windows[0] ?? groups.macos[0] ?? groups.linux[0])) ||
    (release ? pickPrimaryDownload(release.assets) : undefined);
  const downloadUrl = anyAsset?.browser_download_url ?? getLatestReleaseUrl();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-16 px-4 py-12 md:gap-20 md:py-16">
      <section className="relative overflow-hidden rounded-2xl border bg-fd-card">
        <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
          <div className="absolute -bottom-[8%] -left-[10%] w-[85%] max-w-3xl [perspective:1600px] md:-bottom-[6%] md:-left-[4%] md:w-[72%]">
            <div className="origin-center opacity-55 shadow-2xl shadow-black/30 [transform:rotateX(14deg)_rotateY(22deg)_rotateZ(-3deg)_scale(1.08)] [transform-style:preserve-3d] dark:opacity-50">
              <Image
                src={assetPath('/images/player-full.png')}
                alt=""
                width={1280}
                height={800}
                className="h-auto w-full rounded-xl border border-white/10"
                sizes="(max-width: 768px) 90vw, 720px"
                priority
              />
            </div>
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-fd-card/40 to-fd-card" />
          <div className="absolute inset-0 bg-gradient-to-t from-fd-card/85 via-transparent to-fd-card/55" />
        </div>

        <div className="relative z-10 grid items-start gap-10 px-6 py-12 md:px-12 md:py-16 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="flex flex-col items-start text-left">
            <div className="mb-6 inline-flex items-center gap-3.5">
              <Image
                src={assetPath('/logo.png')}
                alt=""
                width={48}
                height={48}
                className="size-12 shrink-0 rounded-xl"
                priority
              />
              <span className="text-2xl font-semibold tracking-tight md:text-3xl">
                {appName}
              </span>
            </div>
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance md:text-5xl">
              {appTagline}
            </h1>
            <p className="mt-4 max-w-xl text-base text-fd-muted-foreground text-pretty md:text-lg">
              {appDescription}
            </p>
            <div className="mt-8 flex flex-col gap-3">
              <div className="flex flex-wrap gap-3">
                <Link
                  href={docsRoute}
                  className={cn(buttonVariants({ variant: 'primary' }), 'gap-2 px-4 py-2')}
                >
                  <BookOpenIcon className="size-4" />
                  Read the docs
                </Link>
                <a
                  href={downloadUrl}
                  className={cn(
                    buttonVariants({ variant: 'secondary' }),
                    'gap-2 border border-fd-border bg-fd-secondary px-4 py-2 text-fd-secondary-foreground',
                  )}
                >
                  <DownloadIcon className="size-4" />
                  {release ? `Download ${release.tag_name}` : 'Download latest'}
                </a>
              </div>
              <div className="flex flex-wrap gap-3">
                {repoStars != null && (
                  <a
                    href={getRepositoryUrl()}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      buttonVariants({ variant: 'secondary' }),
                      'gap-2 border border-fd-border bg-fd-secondary px-4 py-2 text-fd-secondary-foreground',
                    )}
                    aria-label={`${formatStarCount(repoStars)} stars on GitHub`}
                  >
                    <StarIcon className="size-4 fill-current" />
                    <span className="tabular-nums">{formatStarCount(repoStars)}</span>
                  </a>
                )}
                <Link
                  href={changelogRoute}
                  className={cn(
                    buttonVariants({ variant: 'secondary' }),
                    'gap-2 border border-fd-border bg-fd-secondary px-4 py-2 text-fd-secondary-foreground',
                  )}
                >
                  <ScrollTextIcon className="size-4" />
                  Changelog
                </Link>
              </div>
            </div>
          </div>

          <ReleaseDownloadPanel releases={releases} />
        </div>
      </section>

      <section>
        <div className="mb-8 max-w-2xl">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Features</h2>
          <p className="mt-2 text-fd-muted-foreground text-pretty">
            Everything in one desktop client — tray view, theming, DPI-aware scaling, overlays, and
            hardware controls.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4 lg:auto-rows-[14rem] lg:gap-4">
          {features.map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className={cn(
                'group relative isolate flex h-full min-h-[14rem] flex-col overflow-hidden rounded-2xl border bg-fd-card transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-fd-primary/40',
                item.className,
              )}
            >
              <Image
                src={assetPath(item.image)}
                alt=""
                fill
                className="object-cover object-center opacity-70 transition-transform duration-500 ease-out group-hover:scale-105"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-fd-card from-35% via-fd-card/70 to-fd-card/15" />
              <div className="relative z-[1] mt-auto flex flex-col gap-1.5 p-4 sm:p-5">
                <item.icon className="size-5 text-fd-primary" />
                <h3 className="font-medium tracking-tight text-balance">{item.title}</h3>
                <p className="text-sm leading-snug text-fd-muted-foreground text-pretty">
                  {item.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-4 overflow-hidden rounded-2xl border bg-fd-card md:grid-cols-2">
        <div className="relative min-h-56 md:min-h-72">
          <Image
            src={assetPath('/images/player-full-2.png')}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
        </div>
        <div className="flex flex-col justify-center gap-4 p-6 md:p-10">
          <h2 className="text-2xl font-semibold tracking-tight">Built for desktop listening</h2>
          <p className="text-fd-muted-foreground text-pretty">
            Native window chrome, tray controls, Appearance settings for themes and YouTube zoom,
            and integrations that stay out of the way while YouTube Music plays.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`${docsRoute}/install/`}
              className={cn(buttonVariants({ variant: 'secondary' }), 'px-4 py-2')}
            >
              Install guide
            </Link>
            <Link
              href={`${docsRoute}/build/`}
              className={cn(buttonVariants({ variant: 'outline' }), 'px-4 py-2')}
            >
              Build from source
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
