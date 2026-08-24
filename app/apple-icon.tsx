import { ImageResponse } from "next/og";
import { PinkRadioFavicon } from "@/lib/pinkRadioFavicon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<PinkRadioFavicon />, { ...size });
}
