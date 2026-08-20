import { describe, expect, it } from "vitest";
import { isPrivateAddress } from "./streamSecurity";

describe("stream destination validation", () => {
  it("blocks private and loopback addresses", () => {
    expect(isPrivateAddress("127.0.0.1")).toBe(true);
    expect(isPrivateAddress("10.4.2.1")).toBe(true);
    expect(isPrivateAddress("192.168.1.10")).toBe(true);
    expect(isPrivateAddress("::1")).toBe(true);
    expect(isPrivateAddress("fd00::1")).toBe(true);
  });

  it("allows public addresses", () => {
    expect(isPrivateAddress("1.1.1.1")).toBe(false);
    expect(isPrivateAddress("2606:4700:4700::1111")).toBe(false);
  });
});
