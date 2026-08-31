import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import {
  APP_DESCRIPTION,
  APP_GITHUB_URL,
  APP_KEYWORDS,
  APP_NAME,
  APP_SEO_TITLE,
  APP_SHORT_DESCRIPTION,
} from "@/lib/brand";
import {
  buildOgImageUrl,
  googleSiteVerification,
  resolveMetadataBase,
  siteSocialProfiles,
} from "@/lib/siteMetadata";

const metadataBase = resolveMetadataBase();
const ogImage = buildOgImageUrl(null, metadataBase);
const siteUrl = metadataBase.toString();
const googleVerification = googleSiteVerification();

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      name: APP_NAME,
      alternateName: ["Wander FM"],
      url: siteUrl,
    },
    {
      "@type": "WebApplication",
      name: APP_NAME,
      description: APP_DESCRIPTION,
      url: siteUrl,
      sameAs: siteSocialProfiles(),
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Any",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    },
  ],
};

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: APP_SEO_TITLE,
    template: `%s · ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  keywords: APP_KEYWORDS,
  authors: [{ name: APP_NAME, url: APP_GITHUB_URL }],
  creator: APP_NAME,
  publisher: APP_NAME,
  category: "music",
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/icon", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-icon", type: "image/png", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    title: APP_NAME,
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    title: APP_SEO_TITLE,
    description: APP_SHORT_DESCRIPTION,
    type: "website",
    siteName: APP_NAME,
    locale: "en_US",
    url: siteUrl,
    images: [{ url: ogImage, width: 1200, height: 630, alt: APP_NAME }],
  },
  twitter: {
    card: "summary_large_image",
    title: APP_SEO_TITLE,
    description: APP_SHORT_DESCRIPTION,
    images: [ogImage],
  },
  ...(googleVerification
    ? { verification: { google: googleVerification } }
    : {}),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="/cesium/Widgets/widgets.css" />
        <Script id="cesium-base-url" strategy="beforeInteractive">
          {"window.CESIUM_BASE_URL='/cesium/';"}
        </Script>
      </head>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
