"use client";

import { buildStationShareUrl } from "@/lib/shareUrl";
import { APP_NAME } from "@/lib/brand";

export async function shareStationLink(stationId: string, stationName: string) {
  const url = buildStationShareUrl(stationId);

  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({
        title: stationName,
        text: `Listen to ${stationName} on ${APP_NAME}`,
        url,
      });
      return "shared" as const;
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") {
        return "cancelled" as const;
      }
    }
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
    return "copied" as const;
  }

  return "unsupported" as const;
}
