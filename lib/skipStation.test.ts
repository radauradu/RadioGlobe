import { describe, expect, it } from "vitest";
import { nextWorkingStation } from "./skipStation";
import type { StationPoint } from "./radioApi";

const points: StationPoint[] = [
  { id: "a", lat: 0, lng: 0, votes: 1, clickCount: 1 },
  { id: "b", lat: 0.5, lng: 0.5, votes: 1, clickCount: 1 },
  { id: "c", lat: 10, lng: 10, votes: 1, clickCount: 1 },
];

describe("nextWorkingStation", () => {
  it("returns the nearest candidate excluding failed ids", () => {
    const failed = new Set(["a"]);
    expect(
      nextWorkingStation({ lat: 0.1, lng: 0.1 }, points, failed, "a"),
    ).toEqual(points[1]);
  });

  it("returns null when no candidates remain", () => {
    const failed = new Set(["a", "b", "c"]);
    expect(
      nextWorkingStation({ lat: 0, lng: 0 }, points, failed, "a"),
    ).toBeNull();
  });
});
