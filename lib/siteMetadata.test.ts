import { describe, expect, it, vi } from "vitest";
import type { RadioStation } from "./radioApi";
import { APP_GITHUB_URL, APP_NAME } from "./brand";
import {
  buildCanonicalUrl,
  buildOgImageUrl,
  googleSiteVerification,
  readStationIdFromSearchParams,
  siteSocialProfiles,
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
    expect(stationShareTitle(station)).toBe(`Radio Test · ${APP_NAME}`);
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

  it("builds canonical urls without query params", () => {
    const base = new URL("https://wanderfm.com");
    expect(buildCanonicalUrl("/", base)).toBe("https://wanderfm.com/");
    expect(buildCanonicalUrl("/about", base)).toBe("https://wanderfm.com/about");
  });

  it("exposes site social profiles", () => {
    expect(siteSocialProfiles()).toEqual([APP_GITHUB_URL]);
  });

  it("reads optional google site verification", () => {
    vi.stubEnv("GOOGLE_SITE_VERIFICATION", "abc123");
    expect(googleSiteVerification()).toBe("abc123");
    vi.stubEnv("GOOGLE_SITE_VERIFICATION", "  ");
    expect(googleSiteVerification()).toBeUndefined();
    vi.unstubAllEnvs();
  });
});
