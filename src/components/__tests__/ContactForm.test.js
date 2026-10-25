import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import ContactForm from "../ContactForm";

afterEach(cleanup);

// Las pruebas corren sin I18nProvider, asi que useT cae al ingles de en.json.
describe("ContactForm — canales de contacto", () => {
  it("ofrece el enlace de agenda directa, que abre en otra pestana y es seguro", () => {
    render(<ContactForm />);
    const agenda = screen.getByRole("link", { name: /book a demo|agenda una demo/i });
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

  it("el enlace de agenda NO usa el dorado, que ya lo gasta WhatsApp", () => {
    // claude.md: maximo un elemento dorado por pantalla. El de agenda usa
    // btn-ghost (borde marfil) para no romper esa regla y para dar jerarquia.
    render(<ContactForm />);
    const agenda = screen.getByRole("link", { name: /book a demo|agenda una demo/i });
    expect(agenda.className).toContain("btn-ghost");
  });
});
