import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "cesium/Build/Cesium/Widgets/widgets.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Radio Globe",
  description: "Listen to live radio stations around the world.",
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
