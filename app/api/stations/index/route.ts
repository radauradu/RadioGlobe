import { NextResponse } from "next/server";
import { fetchStationPointPage } from "@/lib/radioApi";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const limit = Math.min(Math.max(Number(params.get("limit")) || 5_000, 1), 5_000);
  const offset = Math.max(Number(params.get("offset")) || 0, 0);

  try {
    const { points, rawCount } = await fetchStationPointPage(limit, offset);
    return NextResponse.json(
      {
        stations: points,
        nextOffset: offset + rawCount,
        hasMore: rawCount === limit,
      },
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      },
    );
  } catch (error) {
    console.error("Unable to load station index", error);
    return NextResponse.json(
      { error: "Station index is temporarily unavailable." },
      { status: 503 },
    );
  }
}
