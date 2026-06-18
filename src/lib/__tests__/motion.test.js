import { describe, it, expect } from "vitest";
import { easings, countAt, formatNumber } from "../motion";

describe("easings.easeOutCubic", () => {
  it("starts at 0 and ends at 1", () => {
    expect(easings.easeOutCubic(0)).toBe(0);
    expect(easings.easeOutCubic(1)).toBe(1);
  });
  it("is ahead of linear at the midpoint (ease-out)", () => {
    expect(easings.easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });
});

describe("countAt", () => {
  it("returns 0 at progress 0 and target at progress 1", () => {
    expect(countAt(1000, 0, easings.easeOutCubic)).toBe(0);
    expect(countAt(1000, 1, easings.easeOutCubic)).toBe(1000);
  });
  it("returns an integer mid-way", () => {
    const v = countAt(1000, 0.5, easings.easeOutCubic);
    expect(Number.isInteger(v)).toBe(true);
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(1000);
  });
});

describe("formatNumber", () => {
  it("adds thousands separators by default", () => {
    expect(formatNumber(1248)).toBe("1,248");
  });
  it("applies prefix and suffix", () => {
    expect(formatNumber(95, { suffix: "%" })).toBe("95%");
    expect(formatNumber(5, { prefix: "+" })).toBe("+5");
  });
});
