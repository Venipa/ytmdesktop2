import { ChangelogList } from "@/components/changelog-list";
import { JsonLd } from "@/components/json-ld";
import { cn } from "@/lib/cn";
import { releaseTitle, resolveReleaseChannel } from "@/lib/downloads";
import { formatReleaseDate, getReleaseNotes, getReleasesUrl, listReleases } from "@/lib/github";
import { absolutePageUrl, changelogJsonLd } from "@/lib/seo";
import { appName } from "@/lib/shared";
import { buttonVariants } from "fumadocs-ui/components/ui/button";
import { ArrowUpRightIcon } from "lucide-react";
import type { Metadata } from "next";

const changelogTitle = `Changelog | ${appName}`;
const changelogDescription = `Release notes for ${appName}, the YouTube Music desktop app.`;

export const metadata: Metadata = {
  title: { absolute: changelogTitle },
  description: changelogDescription,
  alternates: { canonical: absolutePageUrl("/changelog") },
  openGraph: {
    url: absolutePageUrl("/changelog"),
    title: changelogTitle,
    description: changelogDescription,
  },
  twitter: {
    title: changelogTitle,
    description: changelogDescription,
  },
};

export default async function ChangelogPage() {
  const releases = await listReleases({ includePrereleases: true });

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-12 px-4 py-12 md:py-16">
      <JsonLd data={changelogJsonLd()} />
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Changelog</h1>
          <p className="mt-2 text-fd-muted-foreground text-pretty">
            Published GitHub releases for {appName}.
          </p>
        </div>
        <a
          href={getReleasesUrl()}
          target="_blank"
          rel="noreferrer"
          className={cn(buttonVariants({ variant: "outline" }), "gap-2 px-4 py-2")}
        >
          GitHub Releases
          <ArrowUpRightIcon className="size-4" />
        </a>
      </header>

      {releases.length === 0 ? (
        <p className="text-sm text-fd-muted-foreground">
          No releases found. Check GitHub Releases or try again after the next publish.
        </p>
      ) : (
        <ChangelogList
          releases={releases.map((release) => ({
            tag: release.tag_name,
            name: releaseTitle(release),
            url: release.html_url,
            date: formatReleaseDate(release.published_at),
            prerelease: release.prerelease === true,
            channel: resolveReleaseChannel(release),
            notes: getReleaseNotes(release.body, null),
          }))}
        />
      )}
    </main>
  );
}
