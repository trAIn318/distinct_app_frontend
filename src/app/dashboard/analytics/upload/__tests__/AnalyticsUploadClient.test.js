import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

const isAuthenticated = vi.fn();
vi.mock("../../../../../lib/session", () => ({
  isAuthenticated: (...a) => isAuthenticated(...a),
}));

const getProperties = vi.fn();
const createProperty = vi.fn();
const previewUpload = vi.fn();
const commitUpload = vi.fn();
vi.mock("../../../../../lib/api", () => ({
  getProperties: (...a) => getProperties(...a),
  createProperty: (...a) => createProperty(...a),
  previewUpload: (...a) => previewUpload(...a),
  commitUpload: (...a) => commitUpload(...a),
}));

import AnalyticsUploadClient from "../AnalyticsUploadClient";

afterEach(cleanup);
beforeEach(() => {
  replace.mockClear();
  isAuthenticated.mockReset();
  getProperties.mockReset();
  createProperty.mockReset();
  previewUpload.mockReset();
  commitUpload.mockReset();
});

describe("AnalyticsUploadClient — auth guard", () => {
  it("redirige a login sin sesión", () => {
    isAuthenticated.mockReturnValue(false);
    render(<AnalyticsUploadClient />);
    expect(replace).toHaveBeenCalledWith("/login?next=/dashboard/analytics/upload");
  });
});

describe("AnalyticsUploadClient — carga", () => {
  beforeEach(() => {
    isAuthenticated.mockReturnValue(true);
    getProperties.mockResolvedValue([
      { id: 10, name: "Rooftop", currency: "USD", active: true, comp_id: 1, company_name: "Distinct" },
    ]);
  });

  it("lista las propiedades activas en el selector", async () => {
    render(<AnalyticsUploadClient />);
    await waitFor(() => expect(screen.getByText("Rooftop")).toBeInTheDocument());
  });

  it("preview -> confirm hace commit y muestra éxito", async () => {
    previewUpload.mockResolvedValue({
      summary: { row_count: 5, period_start: "2026-05-06", period_end: "2026-05-10",
                 net_sales_total: "8716.23", property_name: "Rooftop", batch_id: 1 },
    });
    commitUpload.mockResolvedValue({
      summary: { row_count: 5, period_start: "2026-05-06", period_end: "2026-05-10",
                 net_sales_total: "8716.23", property_name: "Rooftop", batch_id: 2 },
    });
    render(<AnalyticsUploadClient />);
    await waitFor(() => expect(screen.getByText("Rooftop")).toBeInTheDocument());

    // elegir propiedad
    fireEvent.change(screen.getByLabelText(/selectProperty|Propiedad|Property/i), { target: { value: "10" } });
    // elegir archivo válido
    const file = new File(["yyyyMMdd,Net sales\n20260506,1"], "Sales by day.csv", { type: "text/csv" });
    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [file] } });

    // preview
    fireEvent.click(screen.getByRole("button", { name: /preview|vista previa/i }));
    await waitFor(() => expect(previewUpload).toHaveBeenCalledWith("10", file));

    // confirm (el botón solo aparece cuando el summary de la preview ya está en estado)
    const confirmBtn = await screen.findByRole("button", { name: /confirm|confirmar/i });
    fireEvent.click(confirmBtn);
    await waitFor(() => expect(commitUpload).toHaveBeenCalledWith("10", file));
  });

  it("cambiar de propiedad tras la vista previa oculta Confirmar", async () => {
    getProperties.mockResolvedValue([
      { id: 10, name: "Rooftop", currency: "USD", active: true, comp_id: 1, company_name: "Distinct" },
      { id: 20, name: "Pool Bar", currency: "USD", active: true, comp_id: 1, company_name: "Distinct" },
    ]);
    previewUpload.mockResolvedValue({
      summary: { row_count: 5, period_start: "2026-05-06", period_end: "2026-05-10",
                 net_sales_total: "8716.23", property_name: "Rooftop", batch_id: 1 },
    });
    render(<AnalyticsUploadClient />);
    await waitFor(() => expect(screen.getByText("Rooftop")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/selectProperty|Propiedad|Property/i), { target: { value: "10" } });
    const file = new File(["yyyyMMdd,Net sales\n20260506,1"], "Sales by day.csv", { type: "text/csv" });
    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [file] } });

    fireEvent.click(screen.getByRole("button", { name: /preview|vista previa/i }));
    await screen.findByRole("button", { name: /confirm|confirmar/i });

    // cambiar la propiedad después de la vista previa debe ocultar Confirmar
    fireEvent.change(screen.getByLabelText(/selectProperty|Propiedad|Property/i), { target: { value: "20" } });
    expect(screen.queryByRole("button", { name: /confirm|confirmar/i })).not.toBeInTheDocument();
  });
});
