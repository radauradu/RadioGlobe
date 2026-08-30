import { describe, expect, it } from "vitest";
import {
  getCuratedStationById,
  mergeCuratedSearchResults,
  mergeCuratedStationPoints,
  searchCuratedStations,
} from "./curatedStations";

describe("curatedStations", () => {
  it("includes Q93 in New Orleans", () => {
    const station = getCuratedStationById(
      "39fda4c7-3667-4908-8aa4-bf7f05f6e2c7",
    );
    expect(station).toMatchObject({
      name: "Q93",
      city: "New Orleans",
      countryCode: "US",
      streamUrl: "https://stream.revma.ihrhls.com/zc1037",
    });
    expect(station?.lat).toBeCloseTo(29.95, 1);
    expect(station?.lng).toBeCloseTo(-90.07, 1);
  });

  it("matches Q93 by name and city", () => {
    expect(searchCuratedStations({ query: "Q93" })).toHaveLength(1);
    expect(searchCuratedStations({ query: "new orleans" })).toHaveLength(4);
    expect(searchCuratedStations({ query: "rap" })).toHaveLength(4);
    expect(searchCuratedStations({ query: "bounce" })).toHaveLength(1);
    expect(searchCuratedStations({ query: "jazz" })).toHaveLength(0);
  });

  it("includes more New Orleans rap and urban stations", () => {
    expect(getCuratedStationById("3cddec1d-c69a-4ef9-82e1-539f34d5bfe5")).toMatchObject({
      name: "98.5 WYLD",
      city: "New Orleans",
    });
    expect(getCuratedStationById("d81ab50a-0926-47df-9d8a-5ce0f1690daf")).toMatchObject({
      name: "Live504 Radio",
      tags: ["hip hop", "rap", "r&b", "bounce"],
    });
    expect(getCuratedStationById("9621c976-0601-11e8-ae97-52543be04c81")).toMatchObject({
      name: "Old School 106.7",
      streamUrl: "https://18543.live.streamtheworld.com/KMEZFMAAC_SC",
    });
  });

  it("merges curated points into the globe index", () => {
    const merged = mergeCuratedStationPoints([
      {
        id: "other-station",
        lat: 40,
        lng: -74,
        votes: 1,
        clickCount: 2,
      },
    ]);

    expect(merged).toHaveLength(5);
    expect(
      merged.some(
        (point) => point.id === "39fda4c7-3667-4908-8aa4-bf7f05f6e2c7",
      ),
    ).toBe(true);
  });

  it("prioritizes curated matches in search results", () => {
    const merged = mergeCuratedSearchResults(
      [
        {
          id: "popular-station",
          name: "Popular FM",
          streamUrl: "https://example.com/live",
          homepage: "",
          favicon: "",
          country: "The United States Of America",
          countryCode: "US",
          state: "Louisiana",
          city: "New Orleans",
          language: "English",
          tags: ["pop"],
          codec: "MP3",
          bitrate: 128,
          lat: 29.95,
          lng: -90.07,
          votes: 10,
          clickCount: 99_999,
          timezone: "America/Chicago",
        },
      ],
      { query: "Q93" },
    );

    expect(merged[0]?.name).toBe("Q93");
  });
});
