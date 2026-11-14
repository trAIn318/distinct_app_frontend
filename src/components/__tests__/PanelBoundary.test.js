import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import PanelBoundary from "../PanelBoundary";

afterEach(cleanup);

function Reventado() {
  throw new Error("boom en el render");
}

// Los fallos de RED de los dos paneles de la consola ya estaban aislados (cada
// uno tiene su try/catch y su boton de reintentar). Lo que no lo estaba es una
// excepcion de RENDER: se llevaba al hermano por delante, y el hermano es el
// catalogo -- la unica pantalla donde se ve un curso muerto u oculto que ya se
// esta cobrando. Que el panel de empresas reviente no puede esconder eso.
describe("PanelBoundary", () => {
  it("un panel que revienta no se lleva al hermano", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <>
        <PanelBoundary fallback={<p>Este panel no se pudo mostrar</p>}>
          <Reventado />
        </PanelBoundary>
        <PanelBoundary fallback={<p>no deberia salir</p>}>
          <p>el hermano sigue en pie</p>
        </PanelBoundary>
      </>
    );

    expect(screen.getByText("Este panel no se pudo mostrar")).toBeInTheDocument();
    expect(screen.getByText("el hermano sigue en pie")).toBeInTheDocument();
    expect(screen.queryByText("no deberia salir")).toBeNull();
    err.mockRestore();
  });

  it("sin fallo pinta a sus hijos y nada mas", () => {
    render(<PanelBoundary fallback={<p>fallback</p>}><p>contenido</p></PanelBoundary>);

    expect(screen.getByText("contenido")).toBeInTheDocument();
    expect(screen.queryByText("fallback")).toBeNull();
  });
});
