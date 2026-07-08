import { describe, it, expect } from "vitest";
import { donutArc, isMultiSelect, DONUT_RADIUS, DONUT_CIRCUMFERENCE } from "./eval";

describe("donutArc", () => {
  it("0% -> arco vacío: dashOffset = circunferencia completa (nada visible)", () => {
    const { dashArray, dashOffset } = donutArc(0);
    expect(dashArray).toBeCloseTo(DONUT_CIRCUMFERENCE, 5);
    expect(dashOffset).toBeCloseTo(DONUT_CIRCUMFERENCE, 5);
  });

  it("50% -> dashOffset es la mitad de la circunferencia", () => {
    const { dashArray, dashOffset } = donutArc(50);
    expect(dashArray).toBeCloseTo(DONUT_CIRCUMFERENCE, 5);
    expect(dashOffset).toBeCloseTo(DONUT_CIRCUMFERENCE / 2, 5);
  });

  it("100% -> arco completo: dashOffset = 0 (nada oculto)", () => {
    const { dashArray, dashOffset } = donutArc(100);
    expect(dashArray).toBeCloseTo(DONUT_CIRCUMFERENCE, 5);
    expect(dashOffset).toBeCloseTo(0, 5);
  });

  it("usa r=16 (circunferencia = 2*PI*16)", () => {
    expect(DONUT_RADIUS).toBe(16);
    expect(DONUT_CIRCUMFERENCE).toBeCloseTo(2 * Math.PI * 16, 5);
  });

  it("clampea valores fuera de rango [0,100]", () => {
    expect(donutArc(-10).dashOffset).toBeCloseTo(DONUT_CIRCUMFERENCE, 5);
    expect(donutArc(150).dashOffset).toBeCloseTo(0, 5);
  });

  it("maneja valores no numéricos como 0%", () => {
    expect(donutArc(undefined).dashOffset).toBeCloseTo(DONUT_CIRCUMFERENCE, 5);
    expect(donutArc(NaN).dashOffset).toBeCloseTo(DONUT_CIRCUMFERENCE, 5);
  });
});

describe("isMultiSelect", () => {
  it('"multichoice" -> true (checkbox UI)', () => {
    expect(isMultiSelect("multichoice")).toBe(true);
  });

  it('"truefalse" -> false (radio UI)', () => {
    expect(isMultiSelect("truefalse")).toBe(false);
  });

  it("tipos desconocidos o vacíos -> false (single-select por defecto)", () => {
    expect(isMultiSelect("shortanswer")).toBe(false);
    expect(isMultiSelect("")).toBe(false);
    expect(isMultiSelect(undefined)).toBe(false);
    expect(isMultiSelect(null)).toBe(false);
  });
});
