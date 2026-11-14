import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

import OrganizationSchema from "../OrganizationSchema";
import { CONTACT_EMAIL } from "../../lib/config";

afterEach(cleanup);

describe("OrganizationSchema", () => {
  it("emite un JSON-LD que PARSEA", () => {
    // Un JSON-LD con un error de sintaxis se descarta ENTERO y sin aviso: la
    // pagina se ve igual de bien y la identidad de la empresa simplemente no
    // existe para quien la lee. De ahi que la prueba parsee de verdad.
    const { container } = render(<OrganizationSchema />);
    const script = container.querySelector('script[type="application/ld+json"]');

    expect(script).not.toBeNull();
    const datos = JSON.parse(script.innerHTML);
    expect(datos["@type"]).toBe("Organization");
    expect(datos["@context"]).toBe("https://schema.org");
  });

  it("declara el correo de contacto", () => {
    const { container } = render(<OrganizationSchema />);
    const datos = JSON.parse(
      container.querySelector('script[type="application/ld+json"]').innerHTML
    );

    expect(datos.email).toBe(CONTACT_EMAIL);
  });
});
