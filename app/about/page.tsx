import type { Metadata } from "next";
import Link from "next/link";
import {
  APP_DESCRIPTION,
  APP_GITHUB_URL,
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
  return (
    <main className="about-page">
      <div className="about-page-inner">
        <p className="about-page-eyebrow">About</p>
        <h1>{APP_NAME}</h1>
        <p className="about-page-lead">{APP_DESCRIPTION}</p>
        <p>
          Spin the 3D Earth to discover live radio from around the world. Search
          by station name, country, or genre. Save favorites, tune in instantly,
          and share stations with friends.
        </p>
        <p>
          Station data comes from the community-maintained{" "}
          <a
            href="https://www.radio-browser.info/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Radio Browser
          </a>{" "}
          directory. WanderFM is open source on{" "}
          <a href={APP_GITHUB_URL} target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          .
        </p>
        <Link href="/" className="about-page-cta">
          Open the globe
        </Link>
      </div>
    </main>
  );
}
