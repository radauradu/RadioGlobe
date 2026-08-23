import { describe, expect, it } from "vitest";
import {
  canonicalizeGenre,
  genreSearchTags,
  normalizeGenreFacets,
  normalizeGenreKey,
} from "./genreCatalog";

describe("genreCatalog", () => {
  it("normalizes matching keys without accents or punctuation", () => {
    expect(normalizeGenreKey("80's")).toBe("80s");
    expect(normalizeGenreKey("Música Pop")).toBe("musica pop");
  });

  it("merges synonymous tags into one canonical label", () => {
    expect(canonicalizeGenre("pop")).toBe("Pop");
    expect(canonicalizeGenre("pop music")).toBe("Pop");
    expect(canonicalizeGenre("música pop")).toBe("Pop");
    expect(canonicalizeGenre("top 40")).toBe("Pop");
    expect(canonicalizeGenre("hip-hop")).toBe("Hip hop");
    expect(canonicalizeGenre("hip hop")).toBe("Hip hop");
    expect(canonicalizeGenre("música regional mexicana")).toBe("Regional Mexican");
    expect(canonicalizeGenre("grupera")).toBe("Regional Mexican");
  });

  it("excludes non-genre tags such as locations and brands", () => {
    expect(canonicalizeGenre("mexico city")).toBeNull();
    expect(canonicalizeGenre("iheart radio")).toBeNull();
    expect(canonicalizeGenre("fm")).toBeNull();
  });

  it("aggregates facet counts under canonical labels", () => {
    expect(
      normalizeGenreFacets([
        { name: "pop", stationcount: 100 },
        { name: "pop music", stationcount: 50 },
        { name: "jazz", stationcount: 40 },
        { name: "mexico", stationcount: 999 },
      ]),
    ).toEqual(["Jazz", "Pop"]);
  });

  it("returns api tags for a canonical genre", () => {
    expect(genreSearchTags("Pop")).toContain("pop");
    expect(genreSearchTags("Pop")).toContain("pop music");
  });
});
