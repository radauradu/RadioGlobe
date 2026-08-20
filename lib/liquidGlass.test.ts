import { describe, expect, it } from "vitest";
import {
  computeRefractionMagnitudes,
  convexSquircle,
} from "./liquidGlass";

describe("liquid glass refraction", () => {
  it("uses a convex squircle that starts at the rim and flattens inward", () => {
    expect(convexSquircle(0)).toBeCloseTo(0, 5);
    expect(convexSquircle(1)).toBeCloseTo(1, 5);
    expect(convexSquircle(0.5)).toBeGreaterThan(0.8);
  });

  it("keeps convex displacement finite and strongest near the rim", () => {
    const magnitudes = computeRefractionMagnitudes({
      bezelWidth: 18,
      thickness: 72,
    });
    const values = [...magnitudes];
    expect(values.every((value) => Number.isFinite(value))).toBe(true);
    expect(Math.max(...values.map(Math.abs))).toBeGreaterThan(1);
    expect(
      Math.abs(values[Math.floor(values.length * 0.2)] ?? 0),
    ).toBeGreaterThan(1);
    expect(Math.abs(values[0] ?? 0)).toBeGreaterThan(
      Math.abs(values[values.length - 1] ?? 0),
    );
  });
});
