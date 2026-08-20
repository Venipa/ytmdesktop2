import { Provider } from '@/components/provider';
import { assetPath } from '@/lib/paths';
import { appDescription, appName, appTagline, siteUrl } from '@/lib/shared';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './global.css';

const inter = Inter({
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${appName} — ${appTagline}`,
    template: `%s | ${appName}`,
  },
  description: appDescription,
  applicationName: appName,
  icons: {
    icon: assetPath('/favicon.ico'),
  },
  openGraph: {
    type: 'website',
    url: siteUrl,
    siteName: appName,
    title: `${appName} — ${appTagline}`,
    description: appDescription,
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${appName} — ${appTagline}`,
    description: appDescription,
  },
};

import Script from "next/script";

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <head>
        <Script
          src="https://rybbit.venipa.net/api/script.js"
          data-site-id="2"
          strategy="afterInteractive"
          defer
        />
      </head>
      <body className="flex flex-col min-h-screen">
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
