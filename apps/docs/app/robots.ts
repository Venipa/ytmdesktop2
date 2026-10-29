import type { MetadataRoute } from "next";
import { absoluteFileUrl } from "@/lib/seo";

export const revalidate = false;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: absoluteFileUrl("/sitemap.xml"),
  };
}
