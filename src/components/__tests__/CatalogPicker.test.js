import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent, within } from "@testing-library/react";

const getCatalogoDeMembresia = vi.fn();
const guardarCatalogoDeMembresia = vi.fn();
vi.mock("../../lib/api", () => ({
  getCatalogoDeMembresia: (...a) => getCatalogoDeMembresia(...a),
  guardarCatalogoDeMembresia: (...a) => guardarCatalogoDeMembresia(...a),
}));

import CatalogPicker from "../CatalogPicker";

// Sin I18nProvider, useT cae al ingles de en.json: todo se asserta en ingles.

/** Un curso tal como lo reporta `vista_del_catalogo` del backend. */
function curso(extra = {}) {
  return {
    moodle_course_id: 12,
    nombre: "Bartender",
    categoria: "BARTENDER",
    categoria_codigo: null,
    visible: true,
    incluido: false,
    ...extra,
  };
}

/** El cuerpo completo de `GET /api/pay/admin/catalogo/`. */
function vista(extra = {}) {
  return {
    cursos: [curso()],
    incluidos: 0,
    incluidos_sin_curso_en_moodle: [],
    incluidos_ocultos_en_moodle: [],
    ...extra,
  };
}

async function conCatalogo(datos) {
  getCatalogoDeMembresia.mockResolvedValue(datos);
  render(<CatalogPicker />);
  await waitFor(() => expect(getCatalogoDeMembresia).toHaveBeenCalled());
}

beforeEach(() => {
  getCatalogoDeMembresia.mockReset();
  guardarCatalogoDeMembresia.mockReset();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("CatalogPicker: la lista de cursos de la membresia", () => {
  it("lista los cursos que reporta Moodle con su casilla y su estado", async () => {
    await conCatalogo(vista({
      cursos: [
        curso(),
        curso({ moodle_course_id: 20, nombre: "House Keeping", categoria: "AMA DE LLAVES", incluido: true }),
      ],
      incluidos: 1,
    }));
    const bartender = await screen.findByRole("checkbox", { name: /bartender/i });
    expect(bartender.checked).toBe(false);
    expect(screen.getByRole("checkbox", { name: /house keeping/i }).checked).toBe(true);
  });

  it("pinta la categoria con su codigo entre parentesis SOLO cuando el codigo viene", async () => {
    // El caso que motivo esta columna: ALIMENTOS Y BEBIDAS es de HOTELES OPTIMY
    // y su nombre no lo dice; su codigo OPTFB si.
    await conCatalogo(vista({
      cursos: [
        curso({ moodle_course_id: 31, nombre: "Food cost", categoria: "ALIMENTOS Y BEBIDAS", categoria_codigo: "OPTFB" }),
        curso(),
      ],
    }));
    expect(await screen.findByText("ALIMENTOS Y BEBIDAS (OPTFB)")).toBeTruthy();
    expect(screen.getByText("BARTENDER")).toBeTruthy();
    expect(screen.queryByText("BARTENDER ()")).toBeNull();
  });

  it("si Moodle no reporto la categoria dice que no se sabe, no se la inventa", async () => {
    await conCatalogo(vista({ cursos: [curso({ categoria: null, categoria_codigo: null })] }));
    expect(await screen.findByText(/category unknown/i)).toBeTruthy();
  });

  it("guarda la seleccion COMPLETA (no diferencias) y refresca con lo que devuelve el backend", async () => {
    guardarCatalogoDeMembresia.mockResolvedValue(vista({
      cursos: [
        curso({ incluido: true }),
        curso({ moodle_course_id: 20, nombre: "House Keeping", categoria: "AMA DE LLAVES", incluido: true }),
      ],
      incluidos: 2,
    }));
    await conCatalogo(vista({
      cursos: [
        curso(),
        curso({ moodle_course_id: 20, nombre: "House Keeping", categoria: "AMA DE LLAVES", incluido: true }),
      ],
      incluidos: 1,
    }));
    fireEvent.click(await screen.findByRole("checkbox", { name: /bartender/i }));
    fireEvent.click(screen.getByRole("button", { name: /save the catalog/i }));
    // Los DOS ids, no solo el que acaba de cambiar.
    await waitFor(() => expect(guardarCatalogoDeMembresia).toHaveBeenCalledWith([12, 20]));
    expect(await screen.findByText(/catalog saved/i)).toBeTruthy();
    expect(screen.getByText(/2 courses included/i)).toBeTruthy();
  });

  it("si Moodle no responde lo dice y NO muestra una lista vacia", async () => {
    getCatalogoDeMembresia.mockRejectedValueOnce(
      Object.assign(new Error("x"), { status: 503, motivo: "moodle_no_responde" }),
    );
    render(<CatalogPicker />);
    expect(await screen.findByText(/moodle did not answer/i)).toBeTruthy();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    // Y no afirma que no haya cursos que marcar.
    expect(document.body.textContent).not.toMatch(/no course is included/i);
    const reintentar = screen.getByRole("button", { name: /try again/i });
    getCatalogoDeMembresia.mockResolvedValue(vista());
    fireEvent.click(reintentar);
    expect(await screen.findByRole("checkbox", { name: /bartender/i })).toBeTruthy();
  });

  it("avisa cuando no hay ningun curso incluido: asi la membresia no se vende", async () => {
    await conCatalogo(vista({ incluidos: 0 }));
    expect(await screen.findByText(/no course is included/i)).toBeTruthy();
  });

  it("nombra los cursos incluidos que Moodle ya no reporta", async () => {
    // Un curso borrado o archivado hace fallar la matricula ENTERA: sin esta
    // lista el curso culpable no se nombra en ninguna parte.
    await conCatalogo(vista({
      incluidos: 2,
      incluidos_sin_curso_en_moodle: [{ moodle_course_id: 77, nombre: "Mucura House Keeping" }],
    }));
    const aviso = (await screen.findByText(/no longer reports/i)).closest("section");
    expect(within(aviso).getByText(/Mucura House Keeping/)).toBeTruthy();
    expect(within(aviso).getByText("77")).toBeTruthy();
  });

  it("nombra los cursos incluidos que en Moodle estan ocultos", async () => {
    await conCatalogo(vista({
      cursos: [curso({ moodle_course_id: 55, nombre: "Room Service", visible: false, incluido: true })],
      incluidos: 1,
      incluidos_ocultos_en_moodle: [{ moodle_course_id: 55, nombre: "Room Service" }],
    }));
    const aviso = (await screen.findByText(/that are hidden in moodle/i)).closest("section");
    expect(within(aviso).getByText(/Room Service/)).toBeTruthy();
    expect(within(aviso).getByText("55")).toBeTruthy();
  });

  it("no deja guardar con un curso oculto marcado y nombra cual", async () => {
    await conCatalogo(vista({
      cursos: [
        curso({ moodle_course_id: 55, nombre: "Room Service", visible: false, incluido: true }),
        curso({ incluido: true }),
      ],
      incluidos: 2,
      incluidos_ocultos_en_moodle: [{ moodle_course_id: 55, nombre: "Room Service" }],
    }));
    const guardar = await screen.findByRole("button", { name: /save the catalog/i });
    expect(guardar).toBeDisabled();
    expect(screen.getByText(/publish them in moodle/i)).toBeTruthy();
    expect(guardarCatalogoDeMembresia).not.toHaveBeenCalled();
    // Desmarcarlo es la salida: ahi si se puede guardar.
    fireEvent.click(screen.getByRole("checkbox", { name: /room service/i }));
    expect(screen.getByRole("button", { name: /save the catalog/i })).not.toBeDisabled();
  });

  it("un 400 por curso oculto nombra el curso y dice que hay que publicarlo en Moodle", async () => {
    // El curso se oculto en Moodle DESPUES de que esta pantalla lo leyera.
    guardarCatalogoDeMembresia.mockRejectedValueOnce(Object.assign(new Error("x"), {
      status: 400, motivo: "curso_oculto", cursosOcultos: [12],
    }));
    await conCatalogo(vista({ cursos: [curso({ incluido: true })], incluidos: 1 }));
    fireEvent.click(await screen.findByRole("button", { name: /save the catalog/i }));
    const alerta = await screen.findByRole("alert");
    expect(alerta.textContent).toMatch(/Bartender/);
    expect(alerta.textContent).toMatch(/publish them in moodle/i);
    expect(alerta.textContent).not.toMatch(/saved/i);
  });

  it("un 400 por curso desconocido nombra los ids que Moodle no reporta", async () => {
    guardarCatalogoDeMembresia.mockRejectedValueOnce(Object.assign(new Error("x"), {
      status: 400, motivo: "curso_desconocido", cursosDesconocidos: [9],
    }));
    await conCatalogo(vista({ cursos: [curso({ incluido: true })], incluidos: 1 }));
    fireEvent.click(await screen.findByRole("button", { name: /save the catalog/i }));
    const alerta = await screen.findByRole("alert");
    expect(alerta.textContent).toMatch(/does not report/i);
    expect(alerta.textContent).toMatch(/9/);
  });

  it("si guardar falla no afirma que se guardo", async () => {
    guardarCatalogoDeMembresia.mockRejectedValueOnce(Object.assign(new Error("x"), { status: 503 }));
    await conCatalogo(vista({ cursos: [curso({ incluido: true })], incluidos: 1 }));
    fireEvent.click(await screen.findByRole("button", { name: /save the catalog/i }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/catalog saved/i);
  });
});
