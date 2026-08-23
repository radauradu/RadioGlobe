import { describe, expect, it } from "vitest";
import { normalizeStation, normalizeStationPoint } from "./radioApi";

describe("normalizeStation", () => {
  it("normalizes a valid directory record", () => {
    expect(
      normalizeStation({
        stationuuid: "station-123",
        name: "  Test FM ",
        url_resolved: "https://example.com/live.mp3",
        country: "France",
        countrycode: "fr",
        state: "Paris",
        tags: "jazz, soul",
        geo_lat: "48.8",
        geo_long: 2.3,
        lastcheckok: 1,
      }),
    ).toMatchObject({
      id: "station-123",
      name: "Test FM",
      countryCode: "FR",
      city: "Paris",
      tags: ["jazz", "soul"],
      lat: 48.8,
      lng: 2.3,
    });
  });

  it("rejects broken or ungeolocated stations", () => {
    expect(
      normalizeStation({
        stationuuid: "broken",
        name: "Broken",
        url: "https://example.com",
        geo_lat: null,
        geo_long: null,
      }),
    ).toBeNull();
  });

  it("uses coordinates instead of incorrect reported countries", () => {
    expect(
      normalizeStation({
        stationuuid: "mallorca-station",
        name: "Mallorca FM",
        url: "https://example.com/live",
        country: "Germany",
        countrycode: "DE",
        geo_lat: 39.6953,
        geo_long: 2.9036,
        lastcheckok: 1,
      }),
    ).toMatchObject({
      country: "Spain",
      countryCode: "ES",
      timezone: "Europe/Madrid",
    });
  });

  it("creates a lightweight point without full station normalization", () => {
    expect(
      normalizeStationPoint({
        stationuuid: "point-id",
        geo_lat: "48.5",
        geo_long: "2.2",
        lastcheckok: 1,
      }),
    ).toEqual({
      id: "point-id",
      lat: 48.5,
      lng: 2.2,
      votes: 0,
      clickCount: 0,
      approximate: false,
    });
  });

  it("includes popularity data in lightweight points", () => {
    expect(
      normalizeStationPoint({
        stationuuid: "popular-point",
        geo_lat: 52.52,
        geo_long: 13.405,
        votes: 275,
        clickcount: 12_500,
        lastcheckok: 1,
      }),
    ).toMatchObject({
      votes: 275,
      clickCount: 12_500,
    });
  });

  it("rejects ungeolocated stations without a known region", () => {
    const point = normalizeStationPoint({
      stationuuid: "german-station",
      countrycode: "DE",
      lastcheckok: 1,
    });
    expect(point).toBeNull();
  });

  it("uses a German state centroid when geo coordinates are missing", () => {
    const point = normalizeStationPoint({
      stationuuid: "nrw-station",
      countrycode: "DE",
      state: "North Rhine-Westphalia",
      lastcheckok: 1,
    });
    expect(point).toMatchObject({
      id: "nrw-station",
      approximate: true,
    });
    expect(point?.lat).toBeGreaterThan(50);
    expect(point?.lat).toBeLessThan(52.5);
    expect(point?.lng).toBeGreaterThan(5.5);
    expect(point?.lng).toBeLessThan(8.5);
  });

  it("replaces inconsistent geo coordinates with a state-based estimate", () => {
    const station = normalizeStation({
      stationuuid: "nrw-bad-geo",
      name: "NRW FM",
      url: "https://example.com/live",
      country: "Germany",
      countrycode: "DE",
      state: "North Rhine-Westphalia",
      geo_lat: 47.647118264705576,
      geo_long: 9.178861757139344,
      lastcheckok: 1,
    });
    expect(station).toMatchObject({
      country: "Germany",
      countryCode: "DE",
      approximate: true,
    });
    expect(station?.lat).toBeGreaterThan(50);
    expect(station?.lng).toBeGreaterThan(5.5);
  });

  it("rejects null-island coordinates without a known region", () => {
    const point = normalizeStationPoint({
      stationuuid: "null-island-station",
      countrycode: "DE",
      geo_lat: 0,
      geo_long: 0,
      lastcheckok: 1,
    });
    expect(point).toBeNull();
  });
});
