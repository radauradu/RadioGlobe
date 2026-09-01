import { describe, expect, it } from "vitest";
import {
  countryFilterQueryValue,
  displayCountryName,
  stationMatchesCountryFilter,
} from "./countryNames";

describe("displayCountryName", () => {
  it("renames the North Korea API label for the country picker", () => {
    expect(
      displayCountryName("Korea, Democratic People's Republic of"),
    ).toBe("North Korea");
    expect(
      displayCountryName("The Democratic Peoples Republic Of Korea"),
    ).toBe("North Korea");
  });

  it("leaves other countries unchanged", () => {
    expect(displayCountryName("Germany")).toBe("Germany");
  });
});

describe("countryFilterQueryValue", () => {
  it("maps the picker label back to the Radio Browser country name", () => {
    expect(countryFilterQueryValue("North Korea")).toBe(
      "Korea, Democratic People's Republic of",
    );
  });
});

describe("stationMatchesCountryFilter", () => {
  it("matches North Korea by country code and long names", () => {
    expect(
      stationMatchesCountryFilter(
        "Korea, Democratic People's Republic of",
        "KP",
        "North Korea",
      ),
    ).toBe(true);
    expect(stationMatchesCountryFilter("Germany", "DE", "North Korea")).toBe(
      false,
    );
  });
});
