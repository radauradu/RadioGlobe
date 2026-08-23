import { NextResponse } from "next/server";
import { fetchStations } from "@/lib/radioApi";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const stations = await fetchStations();
    return NextResponse.json(
      { stations, fetchedAt: new Date().toISOString() },
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      },
    );
  } catch (error) {
    console.error("Unable to load radio stations", error);
    return NextResponse.json(
      { error: "Station directory is temporarily unavailable." },
      { status: 503 },
    );
  }
}
