import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
}));
vi.mock("../../lib/session", () => ({
  getCurrentUser: () => null,
  clearSession: () => {},
}));
vi.mock("../../lib/api", () => ({ getMenu: () => Promise.resolve([]) }));
vi.mock("../SettingsPanel", () => ({ default: () => null }));
vi.mock("../DashboardMenu", () => ({ default: () => null }));

import Navigation from "../Navigation";

afterEach(cleanup);

// Sin I18nProvider, useT cae al ingles de en.json: todo se asserta en ingles.

// La seccion de contacto vive en la portada y la cabecera no la ofrecia: desde
// cualquier otra pagina no habia forma de llegar a ella. El enlace tiene que
// estar en las DOS navegaciones (escritorio y movil son dos listas pintadas
// aparte, con el mismo array), y la movil va dentro de un contenedor
// `aria-hidden` mientras el menu esta cerrado, de ahi el `hidden: true`.
describe("Navigation -- el enlace de contacto", () => {
  it("apunta a la seccion de contacto de la portada", () => {
    render(<Navigation />);

    const enlaces = screen.getAllByRole("link", { name: "Contact", hidden: true });
    for (const enlace of enlaces) {
      expect(enlace).toHaveAttribute("href", "/#contact");
    }
  });

  it("esta en la navegacion de escritorio y en la de movil", () => {
    render(<Navigation />);

    expect(screen.getAllByRole("link", { name: "Contact", hidden: true })).toHaveLength(2);
  });
});
