import { appDescription, appName, repoUrl, siteUrl } from "@/lib/shared";

export function siteOrigin(): string {
  return siteUrl.replace(/\/+$/, "");
}

/** Page URL with a trailing slash. Absolute so the GitHub Pages basePath is kept. */
export function absolutePageUrl(path: string): string {
  const origin = siteOrigin();
  if (path === "" || path === "/") return `${origin}/`;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${normalized.endsWith("/") ? normalized : `${normalized}/`}`;
}

export function absoluteFileUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${siteOrigin()}${normalized}`;
}

function organizationId(): string {
  return `${siteOrigin()}/#organization`;
}

export function homeJsonLd(): Record<string, unknown> {
  const home = absolutePageUrl("/");
  const repo = repoUrl.replace(/\/+$/, "");
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": organizationId(),
        name: appName,
        url: home,
        logo: absoluteFileUrl("/logo.png"),
        sameAs: [repo],
      },
      {
        "@type": "WebSite",
        "@id": `${siteOrigin()}/#website`,
        name: appName,
        url: home,
        description: appDescription,
        publisher: { "@id": organizationId() },
        inLanguage: "en",
      },
      {
        "@type": "SoftwareApplication",
        name: appName,
        applicationCategory: "MultimediaApplication",
        operatingSystem: "Windows, macOS, Linux",
        url: home,
        description: appDescription,
        downloadUrl: `${repo}/releases/latest`,
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      },
    ],
  };
}

export function breadcrumbJsonLd(
  items: ReadonlyArray<{ name: string; path: string }>,
): Record<string, unknown> {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absolutePageUrl(item.path),
    })),
  };
}

export function docPageJsonLd(page: {
  url: string;
  slugs: readonly string[];
  data: { title: string; description?: string };
}): Record<string, unknown> {
  const crumbs =
    page.slugs.length === 0
      ? [
          { name: "Home", path: "/" },
          { name: page.data.title, path: page.url },
        ]
      : [
          { name: "Home", path: "/" },
          { name: "Docs", path: "/docs" },
          { name: page.data.title, path: page.url },
        ];

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "TechArticle",
        headline: page.data.title,
        description: page.data.description,
        url: absolutePageUrl(page.url),
        mainEntityOfPage: absolutePageUrl(page.url),
        inLanguage: "en",
        isPartOf: { "@type": "WebSite", name: appName, url: absolutePageUrl("/") },
        about: { "@type": "SoftwareApplication", name: appName, url: absolutePageUrl("/") },
      },
      breadcrumbJsonLd(crumbs),
    ],
  };
}

export function changelogJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@graph": [
      breadcrumbJsonLd([
        { name: "Home", path: "/" },
        { name: "Changelog", path: "/changelog" },
      ]),
    ],
  };
}
