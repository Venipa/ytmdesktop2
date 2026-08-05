import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { BookIcon, ScrollTextIcon } from 'lucide-react';
import { DiscordIcon, GitHubIcon } from '@/components/icons';
import { Logo } from '@/components/logo';
import { getRepositoryUrl } from './github';
import { changelogRoute, docsRoute, socials } from './shared';

export function baseOptions(): BaseLayoutProps {
  const repositoryUrl = getRepositoryUrl();

  return {
    nav: {
      title: <Logo />,
      transparentMode: 'top',
    },
    links: [
      {
        icon: <BookIcon />,
        text: 'Documentation',
        url: docsRoute,
        active: 'nested-url',
      },
      {
        icon: <ScrollTextIcon />,
        text: 'Changelog',
        url: changelogRoute,
        active: 'url',
      },
      {
        type: 'custom',
        on: 'nav',
        secondary: true,
        children: (
          <div
            role="separator"
            aria-orientation="vertical"
            className="mx-1 h-4 w-px bg-fd-border"
          />
        ),
      },
      {
        type: 'icon',
        label: `Discord`,
        icon: <DiscordIcon className="size-4" />,
        text: 'Discord',
        url: socials.discord.url,
        external: true,
      },
      {
        type: 'icon',
        label: `GitHub`,
        icon: <GitHubIcon className="size-4" />,
        text: 'GitHub',
        url: repositoryUrl,
        external: true,
      },
    ],
  };
}
