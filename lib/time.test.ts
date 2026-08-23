import { describe, expect, it } from "vitest";
import { formatStationTime } from "./time";

describe("station local time", () => {
  it("formats the same instant in each station timezone", () => {
    const instant = new Date("2026-08-18T18:00:00Z");
    expect(formatStationTime("Europe/Madrid", instant)).toBe("20:00");
    expect(formatStationTime("America/New_York", instant)).toBe("14:00");
  });

  it("falls back to UTC for invalid timezones", () => {
    expect(
      formatStationTime("Not/A_Real_Zone", new Date("2026-08-18T18:00:00Z")),
    ).toBe("18:00");
  });
});
