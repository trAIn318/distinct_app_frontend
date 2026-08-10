import { describe, it, expect } from "vitest";
import { deriveCompanies, activeProperties, isAcceptedFile, buildSalesCsv, formatDeltaPct, salesByWeekday, monthlySales, monthOverMonthPct, salesTemplateCsv } from "../analytics";

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

describe("salesByWeekday", () => {
  it("agrupa por día de semana (Dom→Sáb) sumando net_sales", () => {
    // 2023-01-01 = Domingo, 2023-01-02 = Lunes, 2023-01-08 = Domingo
    const daily = [
      { date: "2023-01-01", net_sales: "100.00" },
      { date: "2023-01-08", net_sales: "50.00" },
      { date: "2023-01-02", net_sales: "30.00" },
    ];
    const r = salesByWeekday(daily);
    expect(r).toHaveLength(7);
    expect(r[0]).toEqual({ dow: 0, net: 150 }); // Domingo: 100+50
    expect(r[1]).toEqual({ dow: 1, net: 30 });  // Lunes: 30
    expect(r[2].net).toBe(0);                    // Martes..Sábado: 0
    expect(r[6].net).toBe(0);
  });

  it("es seguro ante zona horaria (no desfasa el día)", () => {
    // 2023-01-01 debe caer en Domingo (dow 0) sin importar la TZ local
    const r = salesByWeekday([{ date: "2023-01-01", net_sales: "10.00" }]);
    expect(r[0].net).toBe(10);
  });

  it("tolera vacío/null → 7 ceros", () => {
    const r = salesByWeekday(null);
    expect(r).toHaveLength(7);
    expect(r.every((b) => b.net === 0)).toBe(true);
  });
});

describe("monthlySales", () => {
  it("agrupa por mes (YYYY-MM) sumando net_sales, ordenado", () => {
    const daily = [
      { date: "2026-04-30", net_sales: "100.00" },
      { date: "2026-05-01", net_sales: "200.00" },
      { date: "2026-05-15", net_sales: "50.00" },
      { date: "2026-03-10", net_sales: "10.00" },
    ];
    expect(monthlySales(daily)).toEqual([
      { month: "2026-03", net: 10 },
      { month: "2026-04", net: 100 },
      { month: "2026-05", net: 250 },
    ]);
  });
  it("vacío/null → []", () => {
    expect(monthlySales(null)).toEqual([]);
    expect(monthlySales([])).toEqual([]);
  });
});

describe("monthOverMonthPct", () => {
  it("calcula el % del último mes vs el anterior (1 decimal)", () => {
    const m = [{ month: "2026-04", net: 100 }, { month: "2026-05", net: 150 }];
    expect(monthOverMonthPct(m)).toBe(50);       // +50%
  });
  it("null si hay menos de 2 meses o el anterior es 0", () => {
    expect(monthOverMonthPct([{ month: "2026-05", net: 100 }])).toBeNull();
    expect(monthOverMonthPct([])).toBeNull();
    expect(monthOverMonthPct(null)).toBeNull();
    expect(monthOverMonthPct([{ month: "2026-04", net: 0 }, { month: "2026-05", net: 100 }])).toBeNull();
  });
});

describe("salesTemplateCsv", () => {
  it("devuelve la plantilla con el header de Toast y una fila de ejemplo", () => {
    expect(salesTemplateCsv()).toBe(
      "yyyyMMdd,Net sales,Total orders,Total guests\n20260506,1345.50,24,39"
    );
  });
});
