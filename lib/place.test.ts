import { describe, expect, it } from "vitest";
import { cityFromGeocode, formatStationPlace } from "./place";

describe("formatStationPlace", () => {
  it("prefers city over a matching state label", () => {
    expect(
      formatStationPlace({
        city: "Lisbon",
        state: "Lisbon",
        country: "Portugal",
      }),
    ).toEqual({
      city: "Lisbon",
      country: "Portugal",
      line: "Lisbon · Portugal",
    });
  });

  it("uses the directory state when no city is known", () => {
    expect(
      formatStationPlace({
        city: "",
        state: "Newfoundland and Labrador",
        country: "Canada",
      }).line,
    ).toBe("Newfoundland and Labrador · Canada");
  });

  it("does not repeat the country as the city", () => {
    expect(
      formatStationPlace({
        city: "Canada",
        state: "Canada",
        country: "Canada",
      }),
    ).toEqual({
      city: "",
      country: "Canada",
      line: "Canada",
    });
  });
});

describe("cityFromGeocode", () => {
  it("prefers city, then locality", () => {
    expect(cityFromGeocode({ city: "St. John's", locality: "Northeast" })).toBe(
      "St. John's",
    );
    expect(cityFromGeocode({ locality: "Bergen" })).toBe("Bergen");
  });
});
