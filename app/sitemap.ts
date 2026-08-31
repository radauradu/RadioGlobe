import type { MetadataRoute } from "next";
import { resolveMetadataBase } from "@/lib/siteMetadata";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = resolveMetadataBase();

  return [
    {
      url: base.toString(),
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: new URL("/about", base).toString(),
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];
}
