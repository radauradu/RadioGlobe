import { ImageResponse } from "next/og";
import {
  APP_NAME,
  APP_SHORT_DESCRIPTION,
} from "@/lib/brand";
import { formatStationPlace } from "@/lib/place";
import { readStationIdFromSearchParams } from "@/lib/siteMetadata";

export const runtime = "edge";

const OG_CACHE_CONTROL =
  "public, s-maxage=86400, stale-while-revalidate=604800";

const RADIO_BROWSER_MIRRORS = [
  "https://de1.api.radio-browser.info",
  "https://nl1.api.radio-browser.info",
  "https://at1.api.radio-browser.info",
] as const;

const RADIO_BROWSER_USER_AGENT =
  "RadioGlobe/1.0 (https://github.com/radauradu/RadioGlobe)";

interface OgStation {
  name: string;
  state?: string;
  country?: string;
}

async function fetchOgStation(stationId: string): Promise<OgStation | null> {
  for (const mirror of RADIO_BROWSER_MIRRORS) {
    try {
      const response = await fetch(
        `${mirror}/json/stations/byuuid/${encodeURIComponent(stationId)}`,
        {
          headers: { "User-Agent": RADIO_BROWSER_USER_AGENT },
          next: { revalidate: 900 },
        },
      );
      if (!response.ok) continue;

      const rows = (await response.json()) as Array<{
        name?: string;
        state?: string;
        country?: string;
      }>;
      const row = rows[0];
      const name = row?.name?.trim();
      if (!name) continue;

      return {
        name,
        state: row.state?.trim() ?? "",
        country: row.country?.trim() ?? "",
      };
    } catch {
      // Try the next mirror.
    }
  }
  return null;
}

function ogCard(title: string, subtitle: string) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background:
            "radial-gradient(circle at 20% 15%, rgba(126, 52, 108, 0.35), transparent 45%), radial-gradient(circle at 85% 80%, rgba(36, 86, 168, 0.35), transparent 50%), #0b1428",
          color: "#f5f5f7",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div
            style={{
              fontSize: 28,
              letterSpacing: "-0.02em",
              opacity: 0.72,
            }}
          >
            {APP_NAME}
          </div>
          <div
            style={{
              fontSize: 72,
              fontWeight: 700,
              letterSpacing: "-0.04em",
              lineHeight: 1.05,
              maxWidth: "980px",
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 34,
              letterSpacing: "-0.02em",
              opacity: 0.78,
            }}
          >
            {subtitle}
          </div>
        </div>
        <div style={{ fontSize: 24, opacity: 0.55 }}>
          Wander world radio on a 3D globe
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: { "Cache-Control": OG_CACHE_CONTROL },
    },
  );
}

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  const stationId = readStationIdFromSearchParams(params);

  if (!stationId) {
    return ogCard(APP_NAME, APP_SHORT_DESCRIPTION);
  }

  try {
    const station = await fetchOgStation(stationId);
    if (!station) {
      return ogCard(
        APP_NAME,
        APP_SHORT_DESCRIPTION,
      );
    }
    return ogCard(station.name, formatStationPlace(station).line);
  } catch {
    return ogCard(
      APP_NAME,
      APP_SHORT_DESCRIPTION,
    );
  }
}
