import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import ContactForm from "../ContactForm";

afterEach(cleanup);

// Las pruebas corren sin I18nProvider, asi que useT cae al ingles de en.json.
const AGENDA = /you can also contact us here|tambi[eé]n puedes contactarnos aqu[ií]/i;

describe("ContactForm — canales de contacto", () => {
  it("ofrece el enlace de agenda, que abre en otra pestana y es seguro", () => {
    render(<ContactForm />);
    const agenda = screen.getByRole("link", { name: AGENDA });
    expect(agenda).toHaveAttribute("href", "https://meet.hubspot.com/veronica-straw");
    expect(agenda).toHaveAttribute("target", "_blank");
    // Sin esto, la pagina destino puede manipular la nuestra via window.opener.
    expect(agenda.getAttribute("rel")).toContain("noopener");
    expect(agenda.getAttribute("rel")).toContain("noreferrer");
  });

  it("conserva el canal de WhatsApp que ya existia", () => {
    render(<ContactForm />);
    expect(screen.getByRole("link", { name: /whatsapp/i }))
      .toHaveAttribute("href", "https://wa.me/13055481826");
  });

  it("son DOS enlaces distintos y el de agenda no es un boton", () => {
    // El problema que esto fija: antes era un boton pegado debajo del de
    // WhatsApp, cuya etiqueta termina en una flecha, asi que la flecha parecia
    // apuntarle y se leia como si el boton fuera de WhatsApp.
    render(<ContactForm />);
    const whatsapp = screen.getByRole("link", { name: /whatsapp/i });
    const agenda = screen.getByRole("link", { name: AGENDA });
    expect(agenda).not.toBe(whatsapp);
    expect(agenda.className).not.toContain("btn-");
    // Y no hereda la clase del enlace de WhatsApp, que es la que lleva el dorado
    // (claude.md: maximo un elemento dorado por pantalla).
    expect(agenda.className).not.toBe(whatsapp.className);
  });
});
