import Link from 'next/link';
import { ArrowUpRightIcon } from 'lucide-react';
import { buttonVariants } from 'fumadocs-ui/components/ui/button';
import { cn } from '@/lib/cn';
import {
  formatReleaseDate,
  getReleaseNotes,
  getReleasesUrl,
  listReleases,
} from '@/lib/github';
import { appName } from '@/lib/shared';

export const metadata = {
  title: 'Changelog',
  description: `Release history for ${appName}`,
};

export default async function ChangelogPage() {
  const releases = await listReleases({ includePrereleases: true });

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-4 py-12 md:py-16">
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
          className={cn(buttonVariants({ variant: 'outline' }), 'gap-2 px-4 py-2')}
        >
          GitHub Releases
          <ArrowUpRightIcon className="size-4" />
        </a>
      </header>

      {releases.length === 0 ? (
        <div className="rounded-2xl border bg-fd-card p-6">
          <p className="text-fd-muted-foreground text-sm">
            No releases found. Check GitHub Releases or try again after the next publish.
          </p>
        </div>
      ) : (
        <ol className="relative space-y-8 border-l border-fd-border pl-6">
          {releases.map((release) => {
            const notes = getReleaseNotes(release.body, 12);

            return (
              <li key={release.tag_name} className="relative">
                <span
                  aria-hidden
                  className="absolute -left-[1.625rem] top-1.5 size-3 rounded-full border-2 border-fd-primary bg-fd-background"
                />
                <div className="rounded-2xl border bg-fd-card p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={release.html_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-lg font-semibold tracking-tight hover:underline"
                    >
                      {release.name}
                    </Link>
                    <span className="rounded-full border bg-fd-secondary px-2 py-0.5 text-xs font-medium">
                      {release.tag_name}
                    </span>
                    {release.prerelease ? (
                      <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-300">
                        Pre-release
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-fd-muted-foreground">
                    {formatReleaseDate(release.published_at)}
                  </p>
                  {notes.length > 0 ? (
                    <ul className="mt-4 list-disc space-y-1.5 pl-4 text-sm text-fd-muted-foreground">
                      {notes.map((note) => (
                        <li key={note} className="text-pretty">
                          {note}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-4 text-sm text-fd-muted-foreground">No release notes.</p>
                  )}
                  <a
                    href={release.html_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-fd-primary hover:underline"
                  >
                    Open release
                    <ArrowUpRightIcon className="size-3.5" />
                  </a>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </main>
  );
}
