import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
const isAuthenticated = vi.fn();
vi.mock("../../../../lib/session", () => ({ isAuthenticated: (...a) => isAuthenticated(...a) }));
const getSalesReport = vi.fn();
const getProperties = vi.fn();
vi.mock("../../../../lib/api", () => ({
  getSalesReport: (...a) => getSalesReport(...a),
  getProperties: (...a) => getProperties(...a),
}));

import PanelClient from "../PanelClient";

afterEach(cleanup);
beforeEach(() => {
  replace.mockClear(); isAuthenticated.mockReset();
  getSalesReport.mockReset(); getProperties.mockReset();
  window.localStorage.clear();
});

const REPORT = {
  range: { start: "2026-05-06", end: "2026-05-07" },
  currencies: [{
    currency: "USD",
    kpis: { net_sales: "500.00", order_count: 50, guest_count: 80, avg_ticket: "10.00" },
    delta_pct: { net_sales: 12.5, order_count: null, guest_count: 0, avg_ticket: -4 },
    daily: [{ date: "2026-05-06", net_sales: "100.00", order_count: 10, guest_count: 15 }],
    by_property: [{ property_id: 1, property_name: "P1", net_sales: "500.00", order_count: 50, guest_count: 80 }],
  }],
};

describe("PanelClient", () => {
  it("redirige a login sin sesión", () => {
    isAuthenticated.mockReturnValue(false);
    render(<PanelClient />);
    expect(replace).toHaveBeenCalledWith("/login?next=/dashboard/analytics");
  });

  it("muestra KPIs del reporte", async () => {
    isAuthenticated.mockReturnValue(true);
    getProperties.mockResolvedValue([{ id: 1, name: "P1", active: true, comp_id: 1, company_name: "C" }]);
    getSalesReport.mockResolvedValue(REPORT);
    render(<PanelClient />);
    await waitFor(() => expect(screen.getByText("500.00")).toBeInTheDocument());
    expect(screen.getByText("50")).toBeInTheDocument();      // órdenes
    expect(screen.getByText("10.00")).toBeInTheDocument();   // ticket promedio
  });

  it("muestra las gráficas de día de semana y tráfico", async () => {
    isAuthenticated.mockReturnValue(true);
    getProperties.mockResolvedValue([{ id: 1, name: "P1", active: true, comp_id: 1, company_name: "C" }]);
    getSalesReport.mockResolvedValue(REPORT);
    render(<PanelClient />);
    // Nota: se usa el rol "heading" (no getByText) porque el toggle de
    // mostrar/ocultar (Task 2) añade una etiqueta con el mismo texto del
    // título, y getByText fallaría por match duplicado.
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /weekday|día de la semana|dia de la semana/i })
      ).toBeInTheDocument()
    );
    expect(
      screen.getByRole("heading", { name: /traffic|tráfico|trafico/i })
    ).toBeInTheDocument();
  });

  it("muestra el comparativo mensual", async () => {
    isAuthenticated.mockReturnValue(true);
    getProperties.mockResolvedValue([{ id: 1, name: "P1", active: true, comp_id: 1, company_name: "C" }]);
    getSalesReport.mockResolvedValue(REPORT);
    render(<PanelClient />);
    // Nota: heading (no getByText) por la misma razón que arriba — el
    // toggle "Monthly comparison"/"Comparativo mensual" duplica el texto.
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /monthly|mensual/i })).toBeInTheDocument()
    );
  });

  it("permite ocultar una gráfica con su toggle", async () => {
    isAuthenticated.mockReturnValue(true);
    getProperties.mockResolvedValue([{ id: 1, name: "P1", active: true, comp_id: 1, company_name: "C" }]);
    getSalesReport.mockResolvedValue(REPORT);
    render(<PanelClient />);
    // la gráfica de tendencia aparece (heading, no getByText: el toggle
    // duplica el mismo texto como etiqueta del checkbox)
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /^Trend$|Tendencia/i })).toBeInTheDocument()
    );
    // apagar el toggle de "trend" (checkbox con nombre accesible del título de tendencia)
    const trendToggle = screen.getByRole("checkbox", { name: /^Trend$|Tendencia/i });
    fireEvent.click(trendToggle);
    // el encabezado de la gráfica de tendencia desaparece (ya no como heading)
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: /^Trend$|Tendencia/i })).not.toBeInTheDocument()
    );
  });

  it("muestra estado vacío cuando no hay currencies", async () => {
    isAuthenticated.mockReturnValue(true);
    getProperties.mockResolvedValue([]);
    getSalesReport.mockResolvedValue({ range: { start: null, end: null }, currencies: [] });
    render(<PanelClient />);
    await waitFor(() => expect(screen.getByText(/no hay ventas|no sales/i)).toBeInTheDocument());
  });
});

// ── Tabla por sede ────────────────────────────────────────────────────────
// Una compañía como Mucura tiene varias sedes. Hasta aquí lo único por sede era
// una gráfica de barras detrás de una preferencia, así que el jefe no podía
// LEER cuánto puso cada una ni compararla con el total de la compañía.
const TRES_SEDES = {
  range: { start: "2026-05-06", end: "2026-05-07" },
  currencies: [{
    currency: "USD",
    kpis: { net_sales: "10000.00", order_count: 500, guest_count: 760, avg_ticket: "20.00" },
    delta_pct: { net_sales: null, order_count: null, guest_count: null, avg_ticket: null },
    daily: [{ date: "2026-05-06", net_sales: "10000.00", order_count: 500, guest_count: 760 }],
    by_property: [
      { property_id: 7, property_name: "Mucura Centro", net_sales: "6000.00", order_count: 300, guest_count: 500 },
      { property_id: 8, property_name: "Mucura Playa", net_sales: "3000.00", order_count: 200, guest_count: 250 },
      { property_id: 9, property_name: "Mucura Norte", net_sales: "1000.00", order_count: 0, guest_count: 10 },
    ],
  }],
};

function montar(reporte) {
  isAuthenticated.mockReturnValue(true);
  getProperties.mockResolvedValue([{ id: 7, name: "Mucura Centro", active: true, comp_id: 5, company_name: "Mucura" }]);
  getSalesReport.mockResolvedValue(reporte);
  render(<PanelClient />);
}
function tablaSede() {
  return document.querySelector('[data-testid="bysede-USD"]');
}

describe("PanelClient — tabla por sede", () => {
  it("con varias sedes lista cada una con su ticket promedio y su participacion", async () => {
    montar(TRES_SEDES);
    await waitFor(() => expect(tablaSede()).toBeTruthy());
    const t = tablaSede();
    const fila = Array.from(t.querySelectorAll("tbody tr"))
      .find((tr) => tr.textContent.includes("Mucura Playa"));
    expect(fila.textContent).toContain("3000.00");
    expect(fila.textContent).toContain("15.00");   // ticket promedio: 3000/200
    expect(fila.textContent).toContain("30.0%");   // participacion del total
  });

  it("la fila de TOTAL coincide con el KPI de arriba, no con la suma redondeada", async () => {
    montar(TRES_SEDES);
    await waitFor(() => expect(tablaSede()).toBeTruthy());
    const total = tablaSede().querySelector('tbody tr[data-total="1"]');
    expect(total).toBeTruthy();
    expect(total.textContent).toContain("10000.00");
    expect(total.textContent).toContain("500");
    expect(total.textContent).toContain("20.00");
  });

  it("una sede con cero ordenes no pinta Infinity ni NaN", async () => {
    montar(TRES_SEDES);
    await waitFor(() => expect(tablaSede()).toBeTruthy());
    const fila = Array.from(tablaSede().querySelectorAll("tbody tr"))
      .find((tr) => tr.textContent.includes("Mucura Norte"));
    expect(fila.textContent).toContain("0.00");
    expect(document.body.textContent).not.toMatch(/Infinity|NaN/);
  });

  it("NO depende de la preferencia de graficas: esa esconde graficas, no datos", async () => {
    // La gráfica por propiedad vive detrás de `chartPrefs.byProperty`. Si la
    // tabla compartiera ese interruptor, apagar una gráfica escondería los
    // números de las sedes.
    window.localStorage.setItem("analytics.chartPrefs", JSON.stringify({ byProperty: false }));
    montar(TRES_SEDES);
    await waitFor(() => expect(tablaSede()).toBeTruthy());
  });

  it("con UNA sola sede no se pinta, porque repetiria los KPIs", async () => {
    montar(REPORT);   // una sola propiedad
    await waitFor(() => expect(screen.getByText("500.00")).toBeInTheDocument());
    expect(tablaSede()).toBeNull();
  });

  it("ofrece su propia descarga, distinta de la del detalle diario", async () => {
    montar(TRES_SEDES);
    await waitFor(() => expect(tablaSede()).toBeTruthy());
    expect(screen.getByRole("button", { name: /download by location/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^download csv$/i })).toBeInTheDocument();
  });

  it("el nombre de cada sede es encabezado de su fila, para un lector de pantalla", async () => {
    montar(TRES_SEDES);
    await waitFor(() => expect(tablaSede()).toBeTruthy());
    const encabezados = Array.from(tablaSede().querySelectorAll('tbody th[scope="row"]'))
      .map((n) => n.textContent);
    expect(encabezados).toEqual(["Mucura Centro", "Mucura Playa", "Mucura Norte", "TOTAL"]);
  });

  it("no pinta ninguna ruta i18n cruda ni una variable sin sustituir", async () => {
    montar(TRES_SEDES);
    await waitFor(() => expect(tablaSede()).toBeTruthy());
    expect(tablaSede().textContent).not.toMatch(/analytics\./);
    expect(tablaSede().textContent).not.toMatch(/\{\w+\}/);
  });
});
