import { describe, it, expect } from "vitest";
import { deriveCompanies, activeProperties, isAcceptedFile } from "../analytics";

describe("deriveCompanies", () => {
  it("devuelve compañías únicas por comp_id", () => {
    const props = [
      { comp_id: 1, company_name: "Distinct" },
      { comp_id: 1, company_name: "Distinct" },
      { comp_id: 2, company_name: "Mucura" },
    ];
    expect(deriveCompanies(props)).toEqual([
      { comp_id: 1, company_name: "Distinct" },
      { comp_id: 2, company_name: "Mucura" },
    ]);
  });
  it("tolera entradas nulas/incompletas", () => {
    expect(deriveCompanies(null)).toEqual([]);
    expect(deriveCompanies([{ company_name: "x" }])).toEqual([]);
  });
});

describe("activeProperties", () => {
  it("filtra solo activas", () => {
    const props = [{ id: 1, active: true }, { id: 2, active: false }];
    expect(activeProperties(props)).toEqual([{ id: 1, active: true }]);
  });
  it("tolera null", () => {
    expect(activeProperties(null)).toEqual([]);
  });
});

describe("isAcceptedFile", () => {
  it("acepta .zip y .csv (case-insensitive)", () => {
    expect(isAcceptedFile("export.zip")).toBe(true);
    expect(isAcceptedFile("Sales by day.CSV")).toBe(true);
  });
  it("rechaza otros", () => {
    expect(isAcceptedFile("foo.pdf")).toBe(false);
    expect(isAcceptedFile("")).toBe(false);
    expect(isAcceptedFile(null)).toBe(false);
  });
});
