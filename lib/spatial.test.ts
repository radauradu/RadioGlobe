import { describe, expect, it } from "vitest";
import { haversineDistance, nearestStations } from "./spatial";
import type { RadioStation } from "./radioApi";

const station = (id: string, lat: number, lng: number): RadioStation => ({
  id,
  name: id,
  streamUrl: "https://example.com/radio.mp3",
  homepage: "",
  favicon: "",
  country: "Test",
  countryCode: "TS",
  state: "",
  city: "",
  language: "",
  tags: [],
  codec: "MP3",
  bitrate: 128,
  lat,
  lng,
  votes: 0,
  clickCount: 0,
  timezone: "UTC",
});

describe("spatial helpers", () => {
  it("calculates a known great-circle distance", () => {
    const paris = { lat: 48.8566, lng: 2.3522 };
    const london = { lat: 51.5074, lng: -0.1278 };
    expect(haversineDistance(paris, london)).toBeCloseTo(343.6, 1);
  });

  it("returns stations ordered by proximity", () => {
    const results = nearestStations(
      { lat: 0, lng: 0 },
      [station("far", 40, 40), station("near", 1, 1)],
      2,
    );
    expect(results.map(({ id }) => id)).toEqual(["near", "far"]);
  });
});
