import type { MetadataRoute } from "next";
import { resolveMetadataBase } from "@/lib/siteMetadata";

export default function robots(): MetadataRoute.Robots {
  const base = resolveMetadataBase();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/"],
    },
    sitemap: new URL("/sitemap.xml", base).toString(),
  };
}
