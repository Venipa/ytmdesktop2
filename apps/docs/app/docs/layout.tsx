import { source } from '@/lib/source';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import type { Metadata } from 'next';
import { baseOptions } from '@/lib/layout.shared';
import { appName, docsDescription } from '@/lib/shared';

export const metadata: Metadata = {
  title: {
    default: `${appName} Docs`,
    template: `%s | ${appName}`,
  },
  description: docsDescription,
  openGraph: {
    siteName: `${appName} Docs`,
    description: docsDescription,
  },
  twitter: {
    description: docsDescription,
  },
};

export default function Layout({ children }: LayoutProps<'/docs'>) {
  return (
    <DocsLayout tree={source.getPageTree()} {...baseOptions()}>
      {children}
    </DocsLayout>
  );
}
