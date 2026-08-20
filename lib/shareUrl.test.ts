import { describe, expect, it } from "vitest";
import {
  buildStationShareUrl,
  readStationIdFromSearch,
} from "./shareUrl";

describe("shareUrl", () => {
  it("reads a valid station id from search params", () => {
    expect(
      readStationIdFromSearch("?station=abcd1234-5678-90ab-cdef-1234567890ab"),
    ).toBe("abcd1234-5678-90ab-cdef-1234567890ab");
  });

  it("rejects invalid station ids", () => {
    expect(readStationIdFromSearch("?station=bad")).toBeNull();
    expect(readStationIdFromSearch("")).toBeNull();
  });

  it("builds a share url", () => {
    expect(buildStationShareUrl("abcd1234-5678-90ab-cdef-1234567890ab", "https://radio.test")).toBe(
      "https://radio.test/?station=abcd1234-5678-90ab-cdef-1234567890ab",
    );
  });
});
