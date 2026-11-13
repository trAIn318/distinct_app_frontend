import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";

const getDashboardCourses = vi.fn();
const startTraining = vi.fn();
vi.mock("../../lib/api", () => ({
  getDashboardCourses: (...a) => getDashboardCourses(...a),
  startTraining: (...a) => startTraining(...a),
}));

import DashboardMenu from "../DashboardMenu";

// Sin I18nProvider, useT cae al ingles de en.json: todo se asserta en ingles.

const MENU = [
  { group: "dashboard", url: "dashboard/trainy", title: "Training", icon: null },
  { group: "dashboard", url: "dashboard/pay", title: "Pay", icon: null },
];

/** Abre el panel lateral: los cursos se piden la primera vez que se abre. */
async function abrir(menu = MENU) {
  render(<DashboardMenu menu={menu} />);
  fireEvent.click(screen.getByRole("button", { name: /dashboard/i }));
  await waitFor(() => expect(getDashboardCourses).toHaveBeenCalled());
}

beforeEach(() => {
  getDashboardCourses.mockReset();
  startTraining.mockReset();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("el 402 por membresia en el panel lateral Tablero", () => {
  it("un 402 en la lista de cursos ofrece pagar la membresia, no dice sin acceso", async () => {
    // Lo que devuelve `getDashboardCourses` cuando el backend corta con 402: se
    // reconoce por el BOOLEANO `membership_required`, nunca por el texto.
    getDashboardCourses.mockResolvedValue({
      courses: [], moodle_linked: false,
      membership_required: true, estado_suscripcion: "sin_membresia", desde: null,
    });
    await abrir();
    expect(await screen.findByText(/active membership is required/i)).toBeTruthy();
    // NO el mensaje de "no tienes cursos", que es lo que se veia antes.
    expect(screen.queryByText(/you have no courses yet/i)).toBeNull();
    const cta = screen.getByRole("link", { name: /get the membership/i });
    expect(cta.getAttribute("href")).toBe("/dashboard/pay");
  });

  it("con una suscripcion ajena cobrando no dice 'paga' sino que escriba", async () => {
    getDashboardCourses.mockResolvedValue({
      courses: [], moodle_linked: false,
      membership_required: true, estado_suscripcion: "plan_ajeno", desde: "2026-11-01T00:00:00+00:00",
    });
    await abrir();
    expect(await screen.findByText(/not this membership/i)).toBeTruthy();
    expect(document.body.textContent).toMatch(/twice/i);
    expect(screen.queryByRole("link", { name: /get the membership/i })).toBeNull();
    expect(screen.getByRole("link", { name: /review your subscription/i })).toBeTruthy();
  });

  it("con el 402 no ofrece el boton de entrenar: ese salto tambien esta cortado", async () => {
    getDashboardCourses.mockResolvedValue({
      courses: [], moodle_linked: false, membership_required: true, estado_suscripcion: "canceled", desde: null,
    });
    await abrir();
    await screen.findByText(/active membership is required/i);
    expect(screen.queryByRole("button", { name: /^train$/i })).toBeNull();
    expect(startTraining).not.toHaveBeenCalled();
  });

  it("sin 402 y sin cursos sigue diciendo que no hay cursos, no que falte pagar", async () => {
    getDashboardCourses.mockResolvedValue({ courses: [], moodle_linked: true });
    await abrir();
    expect(await screen.findByText(/you have no courses yet/i)).toBeTruthy();
    expect(screen.queryByText(/active membership is required/i)).toBeNull();
    expect(screen.getByRole("button", { name: /^train$/i })).toBeTruthy();
  });

  it("con cursos los pinta y no menciona la membresia", async () => {
    getDashboardCourses.mockResolvedValue({
      courses: [{ id: 3, name: "Bartender", image: "", progress: 50, url: "https://m/course/view.php?id=3" }],
      moodle_linked: true,
    });
    await abrir();
    expect(await screen.findByText("Bartender")).toBeTruthy();
    expect(screen.queryByText(/active membership is required/i)).toBeNull();
  });
});
