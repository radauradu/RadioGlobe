import { describe, expect, it } from "vitest";
import type { RadioStation } from "./radioApi";
import {
  buildOgImageUrl,
  readStationIdFromSearchParams,
  stationShareDescription,
  stationShareTitle,
} from "./siteMetadata";

const station: RadioStation = {
  id: "abcd1234-5678-90ab-cdef-1234567890ab",
  name: "Radio Test",
  streamUrl: "https://example.com/stream",
  homepage: "https://example.com",
  favicon: "",
  country: "Romania",
  countryCode: "RO",
  state: "",
  city: "Bucharest",
  language: "romanian",
  tags: [],
  codec: "MP3",
  bitrate: 128,
  lat: 44.4,
  lng: 26.1,
  votes: 1,
  clickCount: 1,
  timezone: "Europe/Bucharest",
};

describe("siteMetadata", () => {
  it("formats station share title and description", () => {
    expect(stationShareTitle(station)).toBe("Radio Test · Radio Globe");
    expect(stationShareDescription(station)).toBe(
      "Live radio from Bucharest · Romania",
    );
  });

  it("builds og image urls", () => {
    expect(buildOgImageUrl(null, new URL("https://radio.test"))).toBe(
      "https://radio.test/og",
    );
    expect(
      buildOgImageUrl(station.id, new URL("https://radio.test")),
    ).toBe(`https://radio.test/og?station=${station.id}`);
  });

  it("reads station id from search params", () => {
    expect(
      readStationIdFromSearchParams({
        station: "abcd1234-5678-90ab-cdef-1234567890ab",
      }),
    ).toBe("abcd1234-5678-90ab-cdef-1234567890ab");
    expect(readStationIdFromSearchParams({ station: "bad" })).toBeNull();
  });
});
