import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import NavDrawer from "../NavDrawer";

afterEach(cleanup);

function pintar(open) {
  return render(
    <NavDrawer open={open} onOpenChange={() => {}} label="Tablero" trigger="T">
      <button type="button">Dentro del panel</button>
    </NavDrawer>
  );
}

// `NavDrawer` es el cascarón de los dos paneles deslizantes (Tablero y la rueda
// de ajustes), que pasan cerrados la mayor parte del tiempo. Cerrado tiene que
// quedar INERTE: `aria-hidden` lo esconde del lector de pantalla, pero no saca
// su contenido del recorrido con Tab — eso lo hace `inert`, y solo él. Sin esto
// se tabula hacia dentro de un panel invisible.
describe("NavDrawer — el panel cerrado queda inerte", () => {
  it("cerrado lleva el atributo inert", () => {
    pintar(false);

    expect(screen.getByRole("dialog", { hidden: true })).toHaveAttribute("inert");
  });

  it("abierto NO lo lleva", () => {
    // El control: sin esto, pintarlo siempre inerte también pasaría la prueba
    // anterior, y entonces no se podría usar el panel abierto.
    pintar(true);

    expect(screen.getByRole("dialog")).not.toHaveAttribute("inert");
  });
});

// Nota sobre cómo se escapó este defecto, por si alguien quiere volver a
// atraparlo con una prueba del aviso de React y no del atributo: NO funciona.
// React 19 trata `inert` como booleano y avisaba "Received an empty string for
// a boolean attribute `inert`. This will treat the attribute as if it were
// false" — es decir, el atributo no se aplicaba y el panel cerrado nunca estuvo
// inerte. Pero React **deduplica** ese aviso por prop y por tipo, así que una
// prueba que espíe `console.error` pasa en verde en cuanto cualquier render
// anterior del archivo ya lo disparó: pasaría por el motivo equivocado. El
// discriminador de verdad es el atributo, y son las dos pruebas de arriba.
//
// Lo que permitió que viviera en producción: hasta hoy no existía NINGUNA
// prueba que renderizara este componente, así que el aviso no aparecía en la
// salida de la suite y nadie tenía por qué mirarlo.
