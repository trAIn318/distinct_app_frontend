import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
}));

// `loadServerPreferences` sale a la red; el resto solo lee localStorage. Se
// moquea el modulo entero para que la prueba no dependa de ninguno de los dos.
vi.mock("../../lib/preferences", () => ({
  SUPPORTED_LANGUAGES: [
    { code: "en", label: "English" },
    { code: "es", label: "Español" },
  ],
  getStoredTheme: () => "dark",
  getStoredLanguage: () => "en",
  setTheme: () => {},
  setLanguage: () => {},
  applyTheme: () => {},
  loadServerPreferences: () => Promise.resolve(null),
}));

import SettingsPanel from "../SettingsPanel";

afterEach(cleanup);

// Sin I18nProvider, useT cae al ingles de en.json: todo se asserta en ingles.

const MENU = [
  // Entra como chip: es una pantalla propia.
  { group: "SETTINGS", url: "settings/admin-company", title: "Admin Company", icon: "material/groups" },
  // NO entra como chip: `resolveMenuTarget` la resuelve como el control inline
  // de idioma, no como ruta. Si apareciera, habria dos formas de lo mismo.
  { group: "SETTINGS", url: "settings/language", title: "Language" },
];

function abrirPanel(menu = MENU) {
  const vista = render(<SettingsPanel menu={menu} />);
  // El panel nace cerrado: se abre por la rueda, que es como lo abre la persona.
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  return vista;
}

// La queja que origina estos cambios: "Admin Company aparece en blanco, sin
// resaltar, y pasa desapercibido". Vivia como un <li> de texto plano dentro de
// un plegable, debajo de los toggles de idioma y tema. Ahora el panel copia la
// estructura del Tablero: titulo arriba, los accesos a OTRAS pantallas como
// chips en la cabecera, y lo que se maneja aqui dentro (idioma y tema) abajo.
describe("SettingsPanel — la cabecera repite la estructura del Tablero", () => {
  it("SETTINGS es el titulo del panel, no el resumen de un plegable", () => {
    abrirPanel();

    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
  });

  it("ya no hay plegable: el contenido no se esconde detras de un clic", () => {
    const { container } = abrirPanel();

    expect(container.querySelector("details")).toBeNull();
    expect(container.querySelector("summary")).toBeNull();
  });

  it("Admin Company va en la cabecera, junto al titulo y no entre los toggles", () => {
    abrirPanel();

    const titulo = screen.getByRole("heading", { name: "Settings" });
    const enlace = screen.getByRole("link", { name: /Admin Company/ });
    const idioma = screen.getByRole("radiogroup", { name: "UI language" });

    // La cabecera es el bloque que envuelve al titulo: tiene que llevar el chip
    // y NO los controles, que viven en el cuerpo.
    const cabecera = titulo.closest("div");
    expect(cabecera).toContainElement(enlace);
    expect(cabecera).not.toContainElement(idioma);
  });

  it("el chip lleva a la pantalla de Admin Company", () => {
    abrirPanel();

    expect(screen.getByRole("link", { name: /Admin Company/ })).toHaveAttribute(
      "href",
      "/settings/admin-company"
    );
  });
});

describe("SettingsPanel — los controles siguen a un solo clic", () => {
  // Guardia de la decision que se tomo con el usuario: los dos selectores se ven
  // a la vez. Si manana se vuelven pestañas, esta prueba lo avisa.
  it("idioma y tema se ven los dos sin tocar nada mas", () => {
    abrirPanel();

    expect(screen.getByRole("radiogroup", { name: "UI language" })).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Theme" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Español" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Light" })).toBeInTheDocument();
  });

  it("el acceso 'Language' de la BD no se duplica como chip", () => {
    abrirPanel();

    // Solo el chip de Admin Company; "Language" es la etiqueta del control, no
    // un enlace a ninguna parte.
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
});

describe("SettingsPanel — sin sesion", () => {
  it("con el menu vacio quedan solo idioma y tema", () => {
    abrirPanel([]);

    expect(screen.getByRole("radiogroup", { name: "UI language" })).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Theme" })).toBeInTheDocument();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});
