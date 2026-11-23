import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, within, waitFor } from "@testing-library/react";

const iniciarCheckout = vi.fn();
vi.mock("../../lib/api", () => ({
  iniciarCheckout: (...a) => iniciarCheckout(...a),
  abrirPortal: vi.fn(),
  autorizarCupos: vi.fn(),
}));

import PlanCard from "../PlanCard";

// Sin I18nProvider, useT cae al ingles de en.json: todo se asserta en ingles.

const ESSENTIAL = {
  plan_code: "essential", precio_mensual_usd: 299, cupos_incluidos: 25,
  precio_cupo_extra_usd: 4, precio_implementacion_usd: 500,
};
const PERFORMANCE = {
  plan_code: "performance", precio_mensual_usd: 799, cupos_incluidos: 100,
  precio_cupo_extra_usd: 3, precio_implementacion_usd: 2500,
};

/** mi-estado de una empresa sin plan asignado. */
function sinPlan(extra = {}) {
  return {
    soy: "empresa",
    facturacion_activa: true,
    plan_code: null,
    miembros: 3,
    planes_ofrecidos: [ESSENTIAL, PERFORMANCE],
    ...extra,
  };
}

describe("PlanCard sin plan asignado", () => {
  beforeEach(() => {
    iniciarCheckout.mockReset();
  });
  afterEach(cleanup);

  it("ofrece los planes con su precio cuando la empresa no tiene ninguno", () => {
    render(<PlanCard estado={sinPlan()} />);
    expect(screen.getByRole("heading", { name: "Choose your plan" })).toBeTruthy();
    const essential = screen.getByRole("article", { name: "Essential" });
    expect(within(essential).getByText("$299 / month")).toBeTruthy();
    expect(within(essential).getByText("25 seats included")).toBeTruthy();
    expect(within(essential).getByText("Extra seats cost $4 / month.")).toBeTruthy();
    expect(within(essential).getByText("One-time implementation fee: $500")).toBeTruthy();
    const performance = screen.getByRole("article", { name: "Performance" });
    expect(within(performance).getByText("One-time implementation fee: $2500")).toBeTruthy();
    expect(screen.queryByText("No plan assigned yet")).toBeNull();
  });

  it("manda al checkout el plan elegido", () => {
    iniciarCheckout.mockReturnValue(new Promise(() => {}));
    render(<PlanCard estado={sinPlan()} />);
    const performance = screen.getByRole("article", { name: "Performance" });
    fireEvent.click(within(performance).getByRole("button", { name: "Pay" }));
    expect(iniciarCheckout).toHaveBeenCalledTimes(1);
    expect(iniciarCheckout).toHaveBeenCalledWith("performance");
  });

  it("ofrece Enterprise solo como contacto", () => {
    render(<PlanCard estado={sinPlan()} />);
    const enterprise = screen.getByRole("article", { name: "Enterprise" });
    expect(within(enterprise).getByText("The Enterprise plan is arranged directly with our team.")).toBeTruthy();
    expect(within(enterprise).getByRole("button", { name: "Contact us" })).toBeTruthy();
    expect(within(enterprise).queryByRole("button", { name: "Pay" })).toBeNull();
    // Solo Essential y Performance tienen botón de pago.
    expect(screen.getAllByRole("button", { name: "Pay" })).toHaveLength(2);
  });

  it("conserva el mensaje de siempre si el backend no ofrece planes", () => {
    render(<PlanCard estado={sinPlan({ planes_ofrecidos: [] })} />);
    expect(screen.getByText("No plan assigned yet")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Choose your plan" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Pay" })).toBeNull();
  });

  it("desactiva los botones mientras el pago está en curso", async () => {
    iniciarCheckout.mockReturnValue(new Promise(() => {}));
    render(<PlanCard estado={sinPlan()} />);
    const botones = screen.getAllByRole("button", { name: "Pay" });
    fireEvent.click(botones[0]);
    await waitFor(() => {
      for (const b of screen.getAllByRole("button", { name: /Pay|Redirecting/ })) {
        expect(b.disabled).toBe(true);
      }
    });
    fireEvent.click(botones[1]);
    expect(iniciarCheckout).toHaveBeenCalledTimes(1);
  });
});
