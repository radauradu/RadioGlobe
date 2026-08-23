import { ImageResponse } from "next/og";
import { fetchStationById } from "@/lib/radioApi";
import { formatStationPlace } from "@/lib/place";
import { readStationIdFromSearchParams } from "@/lib/siteMetadata";

export const runtime = "edge";

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
            Radio Globe
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
        <div style={{ fontSize: 24, opacity: 0.55 }}>Live radio around the world</div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  const stationId = readStationIdFromSearchParams(params);

  if (!stationId) {
    return ogCard("Radio Globe", "Listen to live radio stations around the world.");
  }

  try {
    const station = await fetchStationById(stationId);
    if (!station) {
      return ogCard("Radio Globe", "Listen to live radio stations around the world.");
    }
    return ogCard(station.name, formatStationPlace(station).line);
  } catch {
    return ogCard("Radio Globe", "Listen to live radio stations around the world.");
  }
}
