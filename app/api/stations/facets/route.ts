import { NextResponse } from "next/server";
import { fetchStationFacets } from "@/lib/radioApi";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const facets = await fetchStationFacets();
    return NextResponse.json(facets, {
      headers: {
        "Cache-Control":
          "public, s-maxage=21600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("Unable to load station filters", error);
    return NextResponse.json(
      { error: "Station filters are temporarily unavailable." },
      { status: 503 },
    );
  }
}
