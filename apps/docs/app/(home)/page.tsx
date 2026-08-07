import Image from 'next/image';
import Link from 'next/link';
import {
  BookOpenIcon,
  Disc3Icon,
  DownloadIcon,
  Gamepad2Icon,
  MonitorSmartphoneIcon,
  PaletteIcon,
  RadioIcon,
  ScrollTextIcon,
  StarIcon,
} from 'lucide-react';
import { buttonVariants } from 'fumadocs-ui/components/ui/button';
import { ReleaseDownloadPanel } from '@/components/release-download-panel';
import { cn } from '@/lib/cn';
import {
  getLatestReleaseUrl,
  getLatestReleasesByChannel,
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

const features = [
  {
    title: 'Last.fm scrobbling',
    description: 'Scrobble what you play and keep your listening history in sync.',
    href: `${docsRoute}/features/lastfm/`,
    icon: Disc3Icon,
    image: '/images/feature-lastfm.jpg',
  },
  {
    title: 'Discord Rich Presence',
    description: 'Show friends the track and artist you are listening to.',
    href: `${docsRoute}/features/discord/`,
    icon: RadioIcon,
    image: '/images/features-rpc2.png',
  },
  {
    title: 'Mini player',
    description: 'Compact always-on-top controls when you need a smaller window.',
    href: `${docsRoute}/features/mini-player/`,
    icon: MonitorSmartphoneIcon,
    image: '/images/feature-miniplayer.jpg',
  },
  {
    title: 'Themes',
    description: 'Theme YouTube Music with bundled or custom stylesheets.',
    href: `${docsRoute}/features/themes/`,
    icon: PaletteIcon,
    image: '/images/player-full-2.png',
  },
  {
    title: 'OBS overlays',
    description: 'Browser sources powered by the local API for now-playing overlays.',
    href: `${docsRoute}/features/obs/`,
    icon: RadioIcon,
    image: '/images/bg-5.jpg',
  },
  {
    title: 'Local API',
    description: 'HTTP endpoints for automation, auth clients, and integrations.',
    href: `${docsRoute}/api/`,
    icon: BookOpenIcon,
    image: '/images/bg-6.jpg',
  },
  {
    title: 'Stream Deck',
    description: 'Control playback from an Elgato Stream Deck plugin.',
    href: `${docsRoute}/integrations/streamdeck/`,
    icon: Gamepad2Icon,
    image: '/images/bg-7.jpg',
  },
  {
    title: 'Changelog',
    description: 'Browse every published GitHub release and notes in one place.',
    href: changelogRoute,
    icon: ScrollTextIcon,
    image: '/images/bg-8.jpg',
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
            Everything in one desktop client — integrations, theming, overlays, and hardware
            controls.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="group relative overflow-hidden rounded-2xl border bg-fd-card transition-colors hover:border-fd-primary/40"
            >
              <div className="relative h-28 overflow-hidden">
                <Image
                  src={assetPath(item.image)}
                  alt=""
                  fill
                  className="object-cover opacity-70 transition-transform duration-500 group-hover:scale-105"
                  sizes="(max-width: 640px) 100vw, 25vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-fd-card via-fd-card/40 to-transparent" />
              </div>
              <div className="relative p-5 pt-2">
                <item.icon className="mb-3 size-5 text-fd-primary" />
                <h3 className="font-medium tracking-tight">{item.title}</h3>
                <p className="mt-1.5 text-sm text-fd-muted-foreground text-pretty">
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
            Native window chrome, tray controls, and integrations that stay out of the way while
            YouTube Music plays.
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
