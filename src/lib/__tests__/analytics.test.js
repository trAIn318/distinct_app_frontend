import { describe, it, expect } from "vitest";
import { deriveCompanies, activeProperties, isAcceptedFile, buildSalesCsv, formatDeltaPct, salesByWeekday, monthlySales, monthOverMonthPct, salesTemplateCsv , buildPropertyRows, buildPropertyCsv } from "../analytics";

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

// ── Por sede: una empresa con varias sedes ─────────────────────────────────
// El negocio real no son grupos de companias: es UNA compania -Mucura- con
// varias sedes. El backend ya manda `by_property` con ventas, ordenes y
// comensales por sede, pero SIN ticket promedio y SIN participacion, y la unica
// tabla del panel es por FECHA. Estas dos funciones son lo que falta.

const SEDES = [
  { property_id: 7, property_name: "Mucura Centro", net_sales: "6000.00", order_count: 300, guest_count: 500 },
  { property_id: 8, property_name: "Mucura Playa", net_sales: "3000.00", order_count: 200, guest_count: 250 },
  { property_id: 9, property_name: "Mucura Norte", net_sales: "1000.00", order_count: 0, guest_count: 10 },
];
const KPIS = { net_sales: "10000.00", order_count: 500, guest_count: 760, avg_ticket: "20.00" };

describe("buildPropertyRows", () => {
  it("calcula el ticket promedio de cada sede, que el backend NO manda", () => {
    const filas = buildPropertyRows(SEDES, KPIS);
    expect(filas.find((f) => f.property_id === 7).avg_ticket).toBe("20.00");
    expect(filas.find((f) => f.property_id === 8).avg_ticket).toBe("15.00");
  });

  it("una sede con ventas y CERO ordenes no revienta ni inventa un promedio", () => {
    // Es un dato posible en el export real: ventas sin ordenes contadas.
    // Dividir por cero daria Infinity y se pintaria literalmente.
    expect(buildPropertyRows(SEDES, KPIS).find((f) => f.property_id === 9).avg_ticket).toBe("0.00");
  });

  it("la participacion de cada sede se mide contra el total ACUMULADO del backend", () => {
    const filas = buildPropertyRows(SEDES, KPIS);
    expect(filas.find((f) => f.property_id === 7).share_pct).toBe("60.0");
    expect(filas.find((f) => f.property_id === 8).share_pct).toBe("30.0");
    expect(filas.find((f) => f.property_id === 9).share_pct).toBe("10.0");
  });

  it("conserva el texto de ventas tal como vino, sin volver a redondearlo", () => {
    // `net_sales` llega como cadena ya redondeada por el backend. Pasarla por
    // Number y volver a formatear puede mover un centavo.
    expect(buildPropertyRows(SEDES, KPIS)[0].net_sales).toBe("6000.00");
  });

  it("la fila de TOTAL es la del backend, no la suma de las filas", () => {
    // DECISION: sumar valores ya redondeados puede dar un centavo distinto del
    // KPI que el panel pinta arriba, y dos totales que se contradicen en la
    // misma pantalla es peor que un redondeo. El total es el KPI.
    const total = buildPropertyRows(SEDES, KPIS).find((f) => f.is_total);
    expect(total.net_sales).toBe("10000.00");
    expect(total.order_count).toBe(500);
    expect(total.guest_count).toBe(760);
    expect(total.avg_ticket).toBe("20.00");
    expect(total.share_pct).toBe("100.0");
  });

  it("el total va al FINAL, despues de las sedes", () => {
    const filas = buildPropertyRows(SEDES, KPIS);
    expect(filas).toHaveLength(4);
    expect(filas.at(-1).is_total).toBe(true);
    expect(filas.slice(0, 3).every((f) => !f.is_total)).toBe(true);
  });

  it("con total en cero no divide por cero: participacion 0 y sin Infinity", () => {
    const filas = buildPropertyRows(
      [{ property_id: 1, property_name: "A", net_sales: "0.00", order_count: 0, guest_count: 0 }],
      { net_sales: "0.00", order_count: 0, guest_count: 0, avg_ticket: "0.00" }
    );
    expect(filas[0].share_pct).toBe("0.0");
    expect(JSON.stringify(filas)).not.toMatch(/Infinity|NaN/);
  });

  it("sin sedes devuelve lista vacia, sin una fila de total huerfana", () => {
    // Un total solo, sin nada que totalizar, afirma que hay datos donde no hay.
    expect(buildPropertyRows([], KPIS)).toEqual([]);
    expect(buildPropertyRows(null, KPIS)).toEqual([]);
  });

  it("una sede sin nombre se identifica, no sale en blanco", () => {
    const filas = buildPropertyRows(
      [{ property_id: 42, property_name: "", net_sales: "5.00", order_count: 1, guest_count: 1 }],
      { net_sales: "5.00", order_count: 1, guest_count: 1, avg_ticket: "5.00" }
    );
    expect(filas[0].property_name).toContain("42");
  });
});

describe("buildPropertyCsv", () => {
  it("lleva una columna por dato y el total incluido", () => {
    const csv = buildPropertyCsv(buildPropertyRows(SEDES, KPIS));
    const lineas = csv.split("\n");
    expect(lineas[0]).toBe("property,net_sales,order_count,guest_count,avg_ticket,share_pct");
    expect(lineas).toHaveLength(5);
    expect(lineas.at(-1)).toBe("TOTAL,10000.00,500,760,20.00,100.0");
  });

  it("un nombre de sede con coma no rompe las columnas", () => {
    // "Mucura, Centro" partiria la fila en dos columnas y desplazaria TODO.
    const csv = buildPropertyCsv(buildPropertyRows(
      [{ property_id: 1, property_name: 'Mucura, Centro "la vieja"', net_sales: "5.00", order_count: 1, guest_count: 1 }],
      { net_sales: "5.00", order_count: 1, guest_count: 1, avg_ticket: "5.00" }
    ));
    expect(csv.split("\n")[1]).toBe('"Mucura, Centro ""la vieja""",5.00,1,1,5.00,100.0');
  });
});
