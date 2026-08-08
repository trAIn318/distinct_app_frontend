import { describe, it, expect } from "vitest";
import { deriveCompanies, activeProperties, isAcceptedFile, buildSalesCsv, formatDeltaPct } from "../analytics";

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

describe("buildSalesCsv", () => {
  it("arma CSV con encabezado y filas", () => {
    const daily = [
      { date: "2026-05-06", net_sales: "100.00", order_count: 10, guest_count: 15 },
      { date: "2026-05-07", net_sales: "300.00", order_count: 30, guest_count: 45 },
    ];
    const csv = buildSalesCsv(daily);
    expect(csv).toBe(
      "date,net_sales,order_count,guest_count\n" +
      "2026-05-06,100.00,10,15\n" +
      "2026-05-07,300.00,30,45"
    );
  });
  it("solo encabezado si no hay filas", () => {
    expect(buildSalesCsv([])).toBe("date,net_sales,order_count,guest_count");
    expect(buildSalesCsv(null)).toBe("date,net_sales,order_count,guest_count");
  });
});

describe("formatDeltaPct", () => {
  it("formatea positivo, negativo y cero con signo", () => {
    expect(formatDeltaPct(12.5)).toBe("▲ 12.5%");
    expect(formatDeltaPct(-8)).toBe("▼ 8%");
    expect(formatDeltaPct(0)).toBe("0%");
  });
  it("devuelve cadena vacía si es null/undefined", () => {
    expect(formatDeltaPct(null)).toBe("");
    expect(formatDeltaPct(undefined)).toBe("");
  });
});
