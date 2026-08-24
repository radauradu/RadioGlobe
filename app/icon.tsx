import { ImageResponse } from "next/og";
import { PinkRadioFavicon } from "@/lib/pinkRadioFavicon";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<PinkRadioFavicon />, { ...size });
}
