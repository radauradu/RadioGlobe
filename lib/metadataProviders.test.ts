import { describe, expect, it } from "vitest";
import {
  iHeartStationId,
  parseAzuraCast,
  parseIcecast,
  parseIHeart,
  parseRadioCo,
  parseShoutcast,
} from "./metadataProviders";
import type { RadioStation } from "./radioApi";

const station: RadioStation = {
  id: "station-id",
  name: "Example FM",
  streamUrl: "https://radio.example/live",
  homepage: "https://example.com",
  favicon: "",
  country: "Test",
  countryCode: "TS",
  state: "",
  city: "",
  language: "",
  tags: [],
  codec: "MP3",
  bitrate: 128,
  lat: 0,
  lng: 0,
  votes: 0,
  clickCount: 0,
  timezone: "UTC",
};

describe("keyless metadata provider parsers", () => {
  it("parses Radio.co current tracks", () => {
    expect(
      parseRadioCo({ current_track: { title: "Artist - Track" } }),
    ).toBe("Artist - Track");
  });

  it("selects the matching AzuraCast station", () => {
    expect(
      parseAzuraCast(
        [
          {
            station: { name: "Other FM" },
            now_playing: { song: { text: "Wrong song" } },
          },
          {
            station: { name: "Example FM" },
            now_playing: {
              song: { artist: "Artist", title: "Track" },
            },
          },
        ],
        station,
      ),
    ).toBe("Artist - Track");
  });

  it("selects the matching Icecast mount", () => {
    expect(
      parseIcecast(
        {
          icestats: {
            source: [
              { listenurl: "https://radio.example/other", title: "Wrong" },
              {
                listenurl: "https://radio.example/live",
                artist: "Artist",
                title: "Track",
              },
            ],
          },
        },
        station,
      ),
    ).toBe("Artist - Track");
  });

  it("uses a titled sibling mount for codec variants", () => {
    expect(
      parseIcecast(
        {
          icestats: {
            source: [
              {
                listenurl: "https://radio.example/live",
                server_name: "Example FM opus",
              },
              {
                listenurl: "https://radio.example/live_mp3",
                server_name: "Example FM",
                title: "Artist - Track",
              },
            ],
          },
        },
        { ...station, name: "Example FM Opus" },
      ),
    ).toBe("Artist - Track");
  });

  it("parses SHOUTcast stats", () => {
    expect(parseShoutcast({ songtitle: "Artist - Track" })).toBe(
      "Artist - Track",
    );
  });

  it("parses iHeart current track metadata", () => {
    expect(
      parseIHeart({
        title: "What You Need",
        artist: "Tems",
        album: "Love Is A Kingdom",
      }),
    ).toBe("Tems - What You Need");
  });

  it("extracts iHeart station ids from revma stream urls", () => {
    expect(
      iHeartStationId({
        ...station,
        streamUrl: "https://stream.revma.ihrhls.com/zc1037",
        homepage: "https://q93.iheart.com/",
      }),
    ).toBe("1037");
  });
});
