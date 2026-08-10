import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";

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
    await waitFor(() => expect(screen.getByText(/weekday|día de la semana|dia de la semana/i)).toBeInTheDocument());
    expect(screen.getByText(/traffic|tráfico|trafico/i)).toBeInTheDocument();
  });

  it("muestra el comparativo mensual", async () => {
    isAuthenticated.mockReturnValue(true);
    getProperties.mockResolvedValue([{ id: 1, name: "P1", active: true, comp_id: 1, company_name: "C" }]);
    getSalesReport.mockResolvedValue(REPORT);
    render(<PanelClient />);
    await waitFor(() => expect(screen.getByText(/monthly|mensual/i)).toBeInTheDocument());
  });

  it("muestra estado vacío cuando no hay currencies", async () => {
    isAuthenticated.mockReturnValue(true);
    getProperties.mockResolvedValue([]);
    getSalesReport.mockResolvedValue({ range: { start: null, end: null }, currencies: [] });
    render(<PanelClient />);
    await waitFor(() => expect(screen.getByText(/no hay ventas|no sales/i)).toBeInTheDocument());
  });
});
