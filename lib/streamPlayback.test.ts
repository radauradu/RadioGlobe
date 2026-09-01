import { describe, expect, it } from "vitest";
import {
  MAX_DIRECT_ATTEMPTS_BEFORE_RELAY,
  MAX_STALL_RECONNECTS,
  RELAY_HARD_SWAP_GUARD_MS,
  RELAY_OVERLAP_LEAD_MS,
  RELAY_ROTATE_MS,
  RELAY_VERCEL_MAX_MS,
  canReconnectLiveStream,
  directPlaybackUrl,
  isRelayPlaybackUrl,
  nextPlaybackMode,
  relayPlaybackUrl,
} from "./streamPlayback";

describe("canReconnectLiveStream", () => {
  it("reconnects after playback has started", () => {
    expect(
      canReconnectLiveStream({
        wantsPlayback: true,
        hasStarted: true,
        reconnectAttempts: 0,
      }),
    ).toBe(true);
  });

  it("does not reconnect before the first successful play", () => {
    expect(
      canReconnectLiveStream({
        wantsPlayback: true,
        hasStarted: false,
        reconnectAttempts: 0,
      }),
    ).toBe(false);
  });

  it("does not reconnect after pause", () => {
    expect(
      canReconnectLiveStream({
        wantsPlayback: false,
        hasStarted: true,
        reconnectAttempts: 0,
      }),
    ).toBe(false);
  });

  it("stops after too many consecutive stalls", () => {
    expect(
      canReconnectLiveStream({
        wantsPlayback: true,
        hasStarted: true,
        reconnectAttempts: MAX_STALL_RECONNECTS,
      }),
    ).toBe(false);
  });
});

describe("directPlaybackUrl", () => {
  it("upgrades http streams to https on an https page", () => {
    expect(directPlaybackUrl("http://radio.example/stream", "https:")).toBe(
      "https://radio.example/stream",
    );
  });

  it("keeps https streams unchanged", () => {
    expect(directPlaybackUrl("https://radio.example/stream", "https:")).toBe(
      "https://radio.example/stream",
    );
  });

  it("keeps http streams on an http page", () => {
    expect(directPlaybackUrl("http://radio.example/stream", "http:")).toBe(
      "http://radio.example/stream",
    );
  });

  it("normalizes streamtheworld _SC paths to .aac for direct playback", () => {
    expect(
      directPlaybackUrl(
        "https://27063.live.streamtheworld.com/WHTAFMAAC_SC",
        "https:",
      ),
    ).toBe("https://27063.live.streamtheworld.com/WHTAFMAAC.aac");
  });

  it("builds relay playback urls", () => {
    expect(relayPlaybackUrl("station-1", 123)).toBe(
      "/api/stream/station-1?session=123",
    );
    expect(isRelayPlaybackUrl("/api/stream/station-1?session=123")).toBe(true);
    expect(isRelayPlaybackUrl("https://radio.example/live")).toBe(false);
  });

  it("starts relay overlap before the rotation deadline", () => {
    expect(RELAY_OVERLAP_LEAD_MS).toBeLessThan(RELAY_ROTATE_MS);
  });

  it("hard-swaps only after overlap has had time to settle", () => {
    expect(RELAY_HARD_SWAP_GUARD_MS).toBeLessThan(RELAY_OVERLAP_LEAD_MS);
    expect(RELAY_ROTATE_MS + RELAY_HARD_SWAP_GUARD_MS).toBeLessThan(
      RELAY_VERCEL_MAX_MS,
    );
  });
});

describe("nextPlaybackMode", () => {
  it("stays on relay once relay playback has started", () => {
    expect(
      nextPlaybackMode({ usingRelay: true, directAttempts: 0 }),
    ).toBe("relay");
    expect(
      nextPlaybackMode({
        usingRelay: true,
        directAttempts: MAX_DIRECT_ATTEMPTS_BEFORE_RELAY,
      }),
    ).toBe("relay");
  });

  it("tries direct while under the attempt cap", () => {
    expect(
      nextPlaybackMode({ usingRelay: false, directAttempts: 0 }),
    ).toBe("direct");
    expect(
      nextPlaybackMode({
        usingRelay: false,
        directAttempts: MAX_DIRECT_ATTEMPTS_BEFORE_RELAY - 1,
      }),
    ).toBe("direct");
  });

  it("falls back to relay after direct attempts are exhausted", () => {
    expect(
      nextPlaybackMode({
        usingRelay: false,
        directAttempts: MAX_DIRECT_ATTEMPTS_BEFORE_RELAY,
      }),
    ).toBe("relay");
  });
});
