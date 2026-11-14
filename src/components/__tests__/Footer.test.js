import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import Footer from "../Footer";
import { CONTACT_EMAIL } from "../../lib/config";

afterEach(cleanup);

// El footer es global: es el unico lugar donde la direccion queda en TODAS las
// paginas, incluidas las de /insights, que son las que se escriben para que
// alguien las encuentre buscando. Un correo que solo vive en el formulario de
// la portada no aparece en ninguna de ellas.
describe("Footer -- el correo de contacto", () => {
  it("publica la direccion como texto visible y enlazada", async () => {
    render(await Footer());

    const enlace = screen.getByRole("link", { name: CONTACT_EMAIL });
    expect(enlace).toHaveAttribute("href", `mailto:${CONTACT_EMAIL}`);
  });

  it("el texto del enlace ES la direccion, no una etiqueta", async () => {
    // "Escribenos" enlazado a un mailto no le dice la direccion a nadie: ni a
    // quien copia el correo a mano, ni a un rastreador que lee texto.
    render(await Footer());

    expect(screen.getByText(CONTACT_EMAIL)).toBeInTheDocument();
  });
});
