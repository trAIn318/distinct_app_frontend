import { describe, it, expect } from "vitest";
import { magneticOffset } from "../magnetic";

const rect = { left: 100, top: 100, width: 100, height: 100 }; // centro en (150,150)

describe("magneticOffset", () => {
  it("returns zero offset when pointer is at the center", () => {
    const { x, y } = magneticOffset(150, 150, rect, 0.3);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(0);
  });
  it("pulls toward the pointer scaled by strength", () => {
    const { x } = magneticOffset(200, 150, rect, 0.3); // 50px a la derecha del centro
    expect(x).toBeCloseTo(15); // 50 * 0.3
  });
  it("scales with strength = 0 to no movement", () => {
    const { x, y } = magneticOffset(200, 200, rect, 0);
    expect(x).toBe(0);
    expect(y).toBe(0);
  });
});
