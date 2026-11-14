import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import MembershipCutoff, { RUTA_PAGOS, PLAN_AJENO } from "../MembershipCutoff";

// Sin I18nProvider, useT cae al ingles de en.json.

afterEach(cleanup);

describe("MembershipCutoff: el aviso del 402 por membresia, compartido", () => {
  it("las constantes son la ruta de pagos y el motivo del plan ajeno del backend", () => {
    expect(RUTA_PAGOS).toBe("/dashboard/pay");
    expect(PLAN_AJENO).toBe("plan_ajeno");
  });

  it("sin motivo ofrece obtener la membresia en la pantalla de pagos", () => {
    render(<MembershipCutoff estado={null} />);
    expect(screen.getByText(/active membership is required/i)).toBeTruthy();
    const cta = screen.getByRole("link", { name: /get the membership/i });
    expect(cta.getAttribute("href")).toBe("/dashboard/pay");
    expect(cta.className).toMatch(/btn-primary/);
  });

  it("con plan ajeno pide revisar la suscripcion y no ofrece pagar", () => {
    render(<MembershipCutoff estado={PLAN_AJENO} />);
    expect(screen.getByText(/not this membership/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: /review your subscription/i })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /get the membership/i })).toBeNull();
  });

  it("acepta las clases de quien lo monta, sin perder el boton primario", () => {
    render(<MembershipCutoff estado={null} textClassName="mi-texto" ctaClassName="mi-cta" />);
    expect(screen.getByText(/active membership is required/i).className).toBe("mi-texto");
    expect(screen.getByRole("link").className).toBe("btn-primary mi-cta");
  });
});
