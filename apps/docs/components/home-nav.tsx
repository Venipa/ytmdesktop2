"use client";

import { buttonVariants } from "fumadocs-ui/components/ui/button";
import { FullSearchTrigger, SearchTrigger } from "fumadocs-ui/layouts/shared/slots/search-trigger";
import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";
import { DiscordIcon, GitHubIcon } from "@/components/icons";
import { HeroDownloadButton } from "@/components/release-download-panel";
import { cn } from "@/lib/cn";
import type { LatestRelease } from "@/lib/downloads";
import { HERO_DOWNLOAD_ID } from "@/lib/shared";

interface HomeNavProps {
  release: LatestRelease | null;
  downloadUrl: string;
  repositoryUrl: string;
  stars: string | null;
  discordUrl: string | null;
  docsRoute: string;
  changelogRoute: string;
  /** Rendered on the server: `appName` comes from a server-only env var. */
  logo: ReactNode;
}

const link =
  "rounded-full px-3 py-1.5 text-sm text-fd-muted-foreground transition-colors hover:text-fd-foreground";

/** Borderless bar at the top; condenses into a floating pill once the page scrolls. */
export function HomeNav({
  release,
  downloadUrl,
  repositoryUrl,
  stars,
  discordUrl,
  docsRoute,
  changelogRoute,
  logo,
}: HomeNavProps) {
  const version = release?.tag_name ?? null;
  const [scrolled, setScrolled] = useState(false);
  // No hero button on the page (changelog) means the CTA is always shown.
  const [heroVisible, setHeroVisible] = useState(true);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    const hero = document.getElementById(HERO_DOWNLOAD_ID);
    if (!hero) {
      setHeroVisible(false);
      return () => window.removeEventListener("scroll", onScroll);
    }
    const observer = new IntersectionObserver(([entry]) =>
      setHeroVisible(entry?.isIntersecting ?? false),
    );
    observer.observe(hero);
    return () => {
      window.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 h-16 px-3 pt-3">
      <nav
        aria-label="Main"
        className={cn(
          "mx-auto flex h-11 items-center gap-1 rounded-full border px-2 transition-[max-width,background-color,border-color,box-shadow] duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none",
          scrolled
            ? "max-w-3xl border-fd-border bg-fd-background/75 shadow-[0_8px_30px_-12px_rgb(0_0_0/0.35)] backdrop-blur-xl"
            : "max-w-6xl border-transparent bg-transparent",
        )}
      >
        <Link href="/" className="flex items-center rounded-full px-2 py-1">
          {logo}
        </Link>
        {version ? (
          <Link
            href={changelogRoute}
            className="hidden h-5 items-center rounded-full border border-fd-border px-2 font-mono text-[11px] leading-none text-fd-muted-foreground tabular-nums transition-colors hover:text-fd-foreground sm:inline-flex"
          >
            {version}
          </Link>
        ) : null}
        <div className="ml-1 flex items-center">
          <Link href={docsRoute} className={link}>
            Docs
          </Link>
          <Link href={changelogRoute} className={cn(link, "hidden sm:inline")}>
            Changelog
          </Link>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <FullSearchTrigger className={cn("hidden w-44 rounded-full", !scrolled && "md:flex")} />
          <SearchTrigger
            className={cn(
              "rounded-full text-fd-muted-foreground hover:text-fd-foreground",
              !scrolled && "md:hidden",
            )}
            hideIfDisabled
          />
          {discordUrl ? (
            <a
              href={discordUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="Discord"
              className={cn(link, "hidden px-2 sm:inline-flex")}
            >
              <DiscordIcon className="size-4" />
            </a>
          ) : null}
          <a
            href={repositoryUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={stars ? `GitHub, ${stars} stars` : "GitHub"}
            className={cn(link, "inline-flex items-center gap-1.5 px-2")}
          >
            <GitHubIcon className="size-4" />
            {stars ? <span className="hidden text-xs tabular-nums sm:inline">{stars}</span> : null}
          </a>
          <HeroDownloadButton
            release={release}
            fallbackUrl={downloadUrl}
            short
            tabIndex={heroVisible ? -1 : undefined}
            aria-hidden={heroVisible ? true : undefined}
            className={cn(
              buttonVariants({ variant: "primary" }),
              "gap-1.5 overflow-hidden whitespace-nowrap rounded-full py-1.5 text-sm transition-[opacity,transform,max-width,padding] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none",
              // Collapse while hidden so the right-hand icons stay flush with the content edge.
              heroVisible
                ? "pointer-events-none max-w-0 translate-x-2 px-0 opacity-0"
                : "max-w-40 translate-x-0 px-3 opacity-100 max-sm:hidden",
            )}
          />
        </div>
      </nav>
    </header>
  );
}
