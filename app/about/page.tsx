import type { Metadata } from "next";
import HomePage from "@/components/HomePage";
import {
  APP_NAME,
  APP_SHORT_DESCRIPTION,
} from "@/lib/brand";
import {
  buildCanonicalUrl,
  buildOgImageUrl,
  resolveMetadataBase,
} from "@/lib/siteMetadata";

export async function generateMetadata(): Promise<Metadata> {
  const metadataBase = resolveMetadataBase();
  const canonical = buildCanonicalUrl("/about", metadataBase);
  const ogImage = buildOgImageUrl(null, metadataBase);

  return {
    title: "About",
    description: APP_SHORT_DESCRIPTION,
    alternates: {
      canonical,
    },
    openGraph: {
      title: `About · ${APP_NAME}`,
      description: APP_SHORT_DESCRIPTION,
      type: "website",
      siteName: APP_NAME,
      url: canonical,
      images: [{ url: ogImage, width: 1200, height: 630, alt: APP_NAME }],
    },
    twitter: {
      card: "summary_large_image",
      title: `About · ${APP_NAME}`,
      description: APP_SHORT_DESCRIPTION,
      images: [ogImage],
    },
  };
}

export default function AboutPage() {
  return <HomePage aboutInitiallyOpen />;
}
