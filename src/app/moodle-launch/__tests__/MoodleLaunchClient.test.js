import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";

const startTraining = vi.fn();
vi.mock("../../../lib/api", () => ({ startTraining: (...a) => startTraining(...a) }));

const params = new URLSearchParams();
vi.mock("next/navigation", () => ({ useSearchParams: () => params }));

import MoodleLaunchClient from "../MoodleLaunchClient";

// Sin I18nProvider, useT cae al ingles de en.json: todo se asserta en ingles.

const realLocation = window.location;
let locationFalso;

beforeEach(() => {
  startTraining.mockReset();
  locationFalso = { replace: vi.fn() };
  Object.defineProperty(window, "location", { value: locationFalso, writable: true, configurable: true });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  Object.defineProperty(window, "location", { value: realLocation, writable: true, configurable: true });
});

describe("el salto a Moodle y el 402 por membresia", () => {
  it("con la loginurl navega a Moodle", async () => {
    startTraining.mockResolvedValue("https://moodle.test/login/index.php?key=1");
    render(<MoodleLaunchClient />);
    await waitFor(() => expect(locationFalso.replace)
      .toHaveBeenCalledWith("https://moodle.test/login/index.php?key=1"));
  });

  /**
   * Esta es la OTRA puerta del mismo 402 (la primera es la lista de cursos). Sin
   * distinguirlo, a quien le falta la membresia se le echaba la culpa a Moodle:
   * "no pudimos iniciar tu sesion", que ni explica ni deja hacer nada.
   */
  it("un 402 por membresia ofrece la membresia y no culpa a Moodle", async () => {
    startTraining.mockRejectedValue(Object.assign(new Error("x"), {
      status: 402, membershipRequired: true, estadoSuscripcion: "sin_membresia",
    }));
    render(<MoodleLaunchClient />);
    expect(await screen.findByText(/active membership is required/i)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/couldn't start your session/i);
    const cta = screen.getByRole("link", { name: /get the membership/i });
    expect(cta.getAttribute("href")).toBe("/dashboard/pay");
  });

  it("con una suscripcion ajena cobrando pide que la revise, no que pague", async () => {
    startTraining.mockRejectedValue(Object.assign(new Error("x"), {
      status: 402, membershipRequired: true, estadoSuscripcion: "plan_ajeno",
    }));
    render(<MoodleLaunchClient />);
    expect(await screen.findByText(/not this membership/i)).toBeTruthy();
    expect(document.body.textContent).toMatch(/twice/i);
    expect(screen.queryByRole("link", { name: /get the membership/i })).toBeNull();
    expect(screen.getByRole("link", { name: /review your subscription/i })).toBeTruthy();
  });

  it("un 402 sin el booleano del cuerpo NO se trata como membresia", async () => {
    // Se distingue por `membership_required`, nunca por el texto ni por el 402.
    startTraining.mockRejectedValue(Object.assign(new Error("x"), { status: 402 }));
    render(<MoodleLaunchClient />);
    expect(await screen.findByText(/couldn't start your session/i)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/active membership is required/i);
  });

  it("cualquier otro fallo sigue mostrando el error de siempre", async () => {
    startTraining.mockRejectedValue(Object.assign(new Error("x"), { status: 502 }));
    render(<MoodleLaunchClient />);
    expect(await screen.findByText(/couldn't start your session/i)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/active membership is required/i);
  });
});
