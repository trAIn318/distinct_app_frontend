import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import ContactOwnersButton from "../ContactOwnersButton";
import { OWNER_EMAILS } from "../../lib/config";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** Finge que el boton esta a `px` del borde inferior de la ventana. */
function espacioDebajo(px) {
  const alto = window.innerHeight;
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
    top: alto - px - 40,
    bottom: alto - px,
    left: 0,
    right: 120,
    width: 120,
    height: 40,
    x: 0,
    y: alto - px - 40,
    toJSON() {},
  });
}

function colocacion(container) {
  return container.querySelector("[data-placement]").getAttribute("data-placement");
}

const ASUNTO = "Interested in: Bartending 101";
const CUERPO = "Hi Veronica,\n\nTell me more.\n";

function pintar(extra) {
  return render(
    <ContactOwnersButton
      subject={ASUNTO}
      body={CUERPO}
      label="I'm interested"
      className="btn-ghost"
      {...extra}
    />
  );
}

function opciones() {
  return screen.getAllByRole("link");
}

describe("ContactOwnersButton", () => {
  it("no fuerza ningun proveedor: el disparador es un boton, no un enlace a Outlook", () => {
    const { container } = pintar();

    const disparador = screen.getByRole("button", { name: /I'm interested/ });
    expect(disparador.tagName).toBe("BUTTON");
    expect(container.querySelector('a[href*="outlook.office.com"]')).toBeNull();
  });

  it("al abrirlo ofrece los tres caminos: app de correo propia, Gmail y Outlook", () => {
    pintar();
    fireEvent.click(screen.getByRole("button", { name: /I'm interested/ }));

    const hrefs = opciones().map((o) => o.getAttribute("href"));
    expect(hrefs).toHaveLength(3);
    expect(hrefs.some((h) => h.startsWith("mailto:"))).toBe(true);
    expect(hrefs.some((h) => h.includes("mail.google.com"))).toBe(true);
    expect(hrefs.some((h) => h.includes("outlook.office.com"))).toBe(true);
  });

  it("cada opcion lleva el asunto y los tres dueños en el destinatario", () => {
    pintar();
    fireEvent.click(screen.getByRole("button", { name: /I'm interested/ }));

    for (const opcion of opciones()) {
      const href = opcion.getAttribute("href");
      expect(decodeURIComponent(href)).toContain(ASUNTO);
      for (const correo of OWNER_EMAILS) {
        expect(decodeURIComponent(href)).toContain(correo);
      }
    }
  });

  it("las etiquetas de las opciones estan traducidas, no son claves crudas", () => {
    pintar();
    fireEvent.click(screen.getByRole("button", { name: /I'm interested/ }));

    for (const opcion of opciones()) {
      expect(opcion.textContent).not.toMatch(/contactOwners\./);
      expect(opcion.textContent.trim().length).toBeGreaterThan(0);
    }
  });

  it("los webmail abren en pestaña nueva; el mailto NO (dejaria una pestaña en blanco)", () => {
    pintar();
    fireEvent.click(screen.getByRole("button", { name: /I'm interested/ }));

    for (const opcion of opciones()) {
      const href = opcion.getAttribute("href");
      if (href.startsWith("mailto:")) {
        expect(opcion.getAttribute("target")).toBeNull();
      } else {
        expect(opcion.getAttribute("target")).toBe("_blank");
        expect(opcion.getAttribute("rel")).toContain("noopener");
      }
    }
  });

  it("con espacio debajo, el menu se abre hacia abajo", () => {
    espacioDebajo(600);
    const { container } = pintar();
    fireEvent.click(screen.getByRole("button", { name: /I'm interested/ }));

    expect(colocacion(container)).toBe("down");
  });

  it("pegado al borde inferior, el menu se abre hacia ARRIBA para no salirse", () => {
    espacioDebajo(20);
    const { container } = pintar();
    fireEvent.click(screen.getByRole("button", { name: /I'm interested/ }));

    expect(colocacion(container)).toBe("up");
  });

  it("empieza cerrado y se cierra con Escape", () => {
    pintar();
    expect(screen.queryAllByRole("link")).toHaveLength(0);

    const disparador = screen.getByRole("button", { name: /I'm interested/ });
    fireEvent.click(disparador);
    expect(screen.queryAllByRole("link")).toHaveLength(3);
    expect(disparador.getAttribute("aria-expanded")).toBe("true");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(disparador.getAttribute("aria-expanded")).toBe("false");
  });
});
