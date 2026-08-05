import { DiscordIcon, GitHubIcon } from '@/components/icons';
import { getBlobUrl, getRepositoryUrl } from '@/lib/github';
import { appName, socials } from '@/lib/shared';

export function Footer() {
  const year = new Date().getFullYear();
  const repositoryUrl = getRepositoryUrl();

  return (
    <footer className="mt-auto border-t border-fd-border/60">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-fd-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {year} {socials.github.handle} · {appName} ·{' '}
          <a
            href={getBlobUrl('LICENSE')}
            target="_blank"
            rel="noreferrer"
            className="underline-offset-4 hover:text-fd-foreground hover:underline"
          >
            MIT
          </a>
        </p>
        <div className="flex items-center gap-3">
          <a
            href={socials.discord.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-fd-foreground"
            aria-label="Discord"
          >
            <DiscordIcon className="size-3.5" />
            <span>Discord</span>
          </a>
          <span aria-hidden className="text-fd-border">
            ·
          </span>
          <a
            href={repositoryUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-fd-foreground"
            aria-label="GitHub repository"
          >
            <GitHubIcon className="size-3.5" />
            <span>GitHub</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
