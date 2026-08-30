import { describe, expect, it } from "vitest";
import {
  MAX_STALL_RECONNECTS,
  canReconnectLiveStream,
  directPlaybackUrl,
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
});
