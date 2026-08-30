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
    expect(searchCuratedStations({ query: "new york" })).toHaveLength(4);
    expect(searchCuratedStations({ query: "atlanta" })).toHaveLength(4);
    expect(searchCuratedStations({ query: "berlin" })).toHaveLength(5);
    expect(searchCuratedStations({ query: "rap" })).toHaveLength(12);
    expect(searchCuratedStations({ query: "underground" })).toHaveLength(5);
    expect(searchCuratedStations({ query: "techno" })).toHaveLength(4);
    expect(searchCuratedStations({ query: "rave" })).toHaveLength(3);
    expect(searchCuratedStations({ query: "bounce" })).toHaveLength(1);
    expect(searchCuratedStations({ query: "jazz" })).toHaveLength(0);
  });

  it("includes New York rap stations", () => {
    expect(getCuratedStationById("a6381986-1c6e-400f-a57e-0bce3ccc1214")).toMatchObject({
      name: "Hot 97",
      city: "New York",
      streamUrl: "https://18313.live.streamtheworld.com/WQHTFMAAC.aac",
    });
    expect(getCuratedStationById("d5f76b95-7507-487e-ad3f-48ba15cd3cce")).toMatchObject({
      name: "Power 105.1",
      city: "New York",
    });
    expect(getCuratedStationById("63c56fba-2e27-4983-a78e-5798aba8d73a")).toMatchObject({
      name: "TRAP RADIO",
      tags: ["trap", "hip hop", "rap"],
    });
    expect(getCuratedStationById("04a32213-9c45-400e-9539-0a5c9afba09b")).toMatchObject({
      name: "MARTINAIR",
      city: "New York",
    });
  });

  it("includes Berlin underground electronic stations", () => {
    expect(getCuratedStationById("6dcb8eb0-9f72-45db-87d1-31c3441d508d")).toMatchObject({
      name: "Evosonic Radio",
      city: "Berlin",
      streamUrl: "https://stream4.themediasite.co.uk/stream/evosonic",
    });
    expect(getCuratedStationById("67a7f497-afe6-46bf-a097-0bb74d6dbe44")).toMatchObject({
      name: "Pure FM",
      city: "Berlin",
    });
    expect(getCuratedStationById("964583e7-0601-11e8-ae97-52543be04c81")).toMatchObject({
      name: "FluxFM - Techno Underground",
      city: "Berlin",
    });
    expect(getCuratedStationById("552e2533-3680-4b21-9898-a1026fc79c4b")).toMatchObject({
      name: "Refuge Worldwide",
      city: "Berlin",
    });
    expect(getCuratedStationById("5e32f2f4-eeeb-4417-8add-7dbe87ae7ba0")).toMatchObject({
      name: "Techno Revival",
      tags: ["techno", "rave", "underground", "90s"],
    });
  });

  it("includes Atlanta rap stations", () => {
    expect(getCuratedStationById("d43c5481-a365-4cdc-b914-2273ddff05eb")).toMatchObject({
      name: "96.1 The Beat",
      city: "Atlanta",
      streamUrl: "https://stream.revma.ihrhls.com/zc741",
    });
    expect(getCuratedStationById("1a107900-a000-4000-8000-010790000001")).toMatchObject({
      name: "Hot 107.9",
      city: "Atlanta",
    });
    expect(getCuratedStationById("1a010300-a000-4000-8000-010300000001")).toMatchObject({
      name: "V-103",
      city: "Atlanta",
    });
    expect(getCuratedStationById("9640da09-0601-11e8-ae97-52543be04c81")).toMatchObject({
      name: "OG 97.9",
      tags: ["hip hop", "rap", "old school", "r&b"],
    });
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

    expect(merged).toHaveLength(18);
    expect(
      merged.some(
        (point) => point.id === "39fda4c7-3667-4908-8aa4-bf7f05f6e2c7",
      ),
    ).toBe(true);
  });

  it("deduplicates Radio Browser listings of curated stations", () => {
    const berlinStation = {
      country: "Germany",
      countryCode: "DE",
      state: "Berlin",
      city: "",
      language: "German",
      homepage: "",
      favicon: "",
      codec: "MP3",
      bitrate: 128,
      tags: [] as string[],
      votes: 0,
      clickCount: 0,
      timezone: "Europe/Berlin",
      lat: 0,
      lng: 0,
    };

    const merged = mergeCuratedSearchResults(
      [
        {
          ...berlinStation,
          id: "d6a4f5a9-0000-4000-8000-000000000001",
          name: "Evosonic Radio",
          streamUrl: "https://stream.evosonic.de/",
        },
        {
          ...berlinStation,
          id: "ac199993-0000-4000-8000-000000000002",
          name: "Evosonic Radio",
          streamUrl: "https://stream.evosonic.de/",
        },
        {
          ...berlinStation,
          id: "edb81cbf-0000-4000-8000-000000000003",
          name: "Refuge Worldwide",
          streamUrl: "https://streaming.radio.co/s3699c5e49/listen",
          city: "Berlin",
          lat: 52.48,
          lng: 13.4,
        },
        {
          ...berlinStation,
          id: "hamburg-pure-fm",
          name: "pure fm - hamburgs electronic radio",
          streamUrl: "http://purefm.radionetz.de/purefm-hh.mp3",
          state: "Hamburg",
        },
      ],
      { query: "Evosonic" },
    );

    expect(merged.filter((station) => station.name === "Evosonic Radio")).toHaveLength(1);
    expect(merged[0]?.id).toBe("6dcb8eb0-9f72-45db-87d1-31c3441d508d");
    expect(merged.some((station) => station.id === "hamburg-pure-fm")).toBe(true);
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
