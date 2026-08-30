import { describe, expect, it } from "vitest";
import { normalizeBroadcastText, parseNowPlaying } from "./text";

describe("broadcast text normalization", () => {
  it("decodes legacy percent-u escapes", () => {
    expect(
      normalizeBroadcastText(
        "Malan Ey%u00f0un & Alt vi%u00f0 sama lagi%u00f0",
      ),
    ).toBe("Malan Eyðun & Alt við sama lagið");
  });

  it("repairs UTF-8 interpreted as Latin-1", () => {
    expect(normalizeBroadcastText("BjÃ¶rk - JÃ³ga")).toBe("Björk - Jóga");
  });

  it("preserves legitimate scripts and Icelandic letters", () => {
    expect(normalizeBroadcastText("Norðlýsið — Радио 東京")).toBe(
      "Norðlýsið — Радио 東京",
    );
  });

  it("decodes common HTML entities", () => {
    expect(normalizeBroadcastText("Earth, Wind &amp; Fire")).toBe(
      "Earth, Wind & Fire",
    );
  });
});

describe("parseNowPlaying", () => {
  it("splits artist and song from icy-style titles", () => {
    expect(parseNowPlaying("The Weeknd - Blinding Lights")).toEqual({
      artist: "The Weeknd",
      song: "Blinding Lights",
    });
  });

  it("treats a single line as the song", () => {
    expect(parseNowPlaying("News headlines")).toEqual({
      artist: null,
      song: "News headlines",
    });
  });

  it("returns empty fields when metadata is missing", () => {
    expect(parseNowPlaying(null)).toEqual({ artist: null, song: null });
  });

  it("extracts iHeart revma icy song titles", () => {
    expect(
      parseNowPlaying(
        'Lil Wayne - text="Uproar" song_spot="M" spotInstanceId="-1"',
      ),
    ).toEqual({
      artist: "Lil Wayne",
      song: "Uproar",
    });
  });

  it("formats Live504 mix slugs into artist and song", () => {
    expect(parseNowPlaying("live504mixnikki2")).toEqual({
      artist: "Live504 Radio",
      song: "Mix Nikki 2",
    });
  });
});
