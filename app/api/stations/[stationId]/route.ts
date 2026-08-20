import { NextResponse } from "next/server";
import { fetchStationById } from "@/lib/radioApi";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ stationId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { stationId } = await context.params;
    const station = await fetchStationById(stationId);
    if (!station) {
      return NextResponse.json({ error: "Station not found." }, { status: 404 });
    }
    return NextResponse.json(
      { station },
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=900, stale-while-revalidate=3600",
        },
      },
    );
  } catch (error) {
    console.error("Unable to load station details", error);
    return NextResponse.json(
      { error: "Station details are temporarily unavailable." },
      { status: 503 },
    );
  }
}
