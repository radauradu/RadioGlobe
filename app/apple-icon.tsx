import { ImageResponse } from "next/og";
import { PinkGlobeFavicon } from "@/lib/pinkGlobeFavicon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<PinkGlobeFavicon />, { ...size });
}
