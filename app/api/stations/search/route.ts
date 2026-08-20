import { NextResponse } from "next/server";
import { searchStations } from "@/lib/radioApi";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  try {
    const stations = await searchStations({
      query: params.get("query") ?? "",
      country:
        params.get("country") === "all" ? "" : params.get("country") ?? "",
      genre: params.get("genre") === "all" ? "" : params.get("genre") ?? "",
      language:
        params.get("language") === "all" ? "" : params.get("language") ?? "",
      limit: 120,
    });
    return NextResponse.json(
      { stations },
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=300, stale-while-revalidate=1800",
        },
      },
    );
  } catch (error) {
    console.error("Unable to search stations", error);
    return NextResponse.json(
      { error: "Station search is temporarily unavailable." },
      { status: 503 },
    );
  }
}
