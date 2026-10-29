import type { MetadataRoute } from "next";
import { absolutePageUrl } from "@/lib/seo";
import { changelogRoute } from "@/lib/shared";
import { source } from "@/lib/source";

export const revalidate = false;

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const docs = source.getPages().map((page) => ({
    url: absolutePageUrl(page.url),
    lastModified,
    changeFrequency: "monthly" as const,
    priority: page.slugs.length === 0 ? 0.8 : 0.7,
  }));

  return [
    {
      url: absolutePageUrl("/"),
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: absolutePageUrl(changelogRoute),
      lastModified,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    ...docs,
  ];
}
