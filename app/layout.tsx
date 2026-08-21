import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "cesium/Build/Cesium/Widgets/widgets.css";
import "./globals.css";
import { buildOgImageUrl, resolveMetadataBase } from "@/lib/siteMetadata";

const metadataBase = resolveMetadataBase();
const ogImage = buildOgImageUrl(null, metadataBase);

export const metadata: Metadata = {
  metadataBase,
  title: "Radio Globe",
  description: "Listen to live radio stations around the world.",
  applicationName: "Radio Globe",
  appleWebApp: {
    capable: true,
    title: "Radio Globe",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    title: "Radio Globe",
    description: "Listen to live radio stations around the world.",
    type: "website",
    images: [{ url: ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Radio Globe",
    description: "Listen to live radio stations around the world.",
    images: [ogImage],
  },
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
        <Script id="cesium-base-url" strategy="beforeInteractive">
          {"window.CESIUM_BASE_URL='/cesium/';"}
        </Script>
      </head>
      <body>{children}</body>
    </html>
  );
}
