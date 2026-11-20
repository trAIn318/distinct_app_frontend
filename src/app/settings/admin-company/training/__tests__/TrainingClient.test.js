import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent, within } from "@testing-library/react";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

const isAuthenticated = vi.fn();
vi.mock("../../../../../lib/session", () => ({
  isAuthenticated: (...a) => isAuthenticated(...a),
  getAccessToken: () => "token",
}));

const getCatalogoDeFormacion = vi.fn();
const cubrirCurso = vi.fn();
const dejarDeCubrirCurso = vi.fn();
const getCompanyMembers = vi.fn();
vi.mock("../../../../../lib/api", () => ({
  getCatalogoDeFormacion: (...a) => getCatalogoDeFormacion(...a),
  cubrirCurso: (...a) => cubrirCurso(...a),
  dejarDeCubrirCurso: (...a) => dejarDeCubrirCurso(...a),
  getCompanyMembers: (...a) => getCompanyMembers(...a),
}));

import TrainingClient from "../TrainingClient";
import en from "../../../../../i18n/messages/en.json";
import es from "../../../../../i18n/messages/es.json";

// Sin I18nProvider, `useT` cae al ingles de en.json: toda asercion de texto va
// contra el ingles.

const CATALOGO = {
  secciones: [
    { nombre: "General", cursos: [{ moodle_course_id: 7, nombre: "Service Basics" }] },
    { nombre: "Mi empresa", cursos: [{ moodle_course_id: 9, nombre: "House Rules" }] },
  ],
  avisos: 0,
};

function personas(desde, n, total) {
  return {
    members: Array.from({ length: n }, (_, i) => {
      const id = desde + i;
      return { id, email: `p${id}@x.com`, firstname: `Nombre${id}`, lastname: "Apellido", active: true };
    }),
    invitations: [],
    total,
  };
}

const fila = (usr_id, resultado, detalle = null) => ({ usr_id, email: `p${usr_id}@x.com`, resultado, detalle });

// La frase REAL que el backend manda en su 503. Si la pantalla alguna vez pinta
// el texto del servidor en vez de su propia copia, esta frase sale en pantalla
// y las pruebas se ponen rojas.
const FRASE_DEL_SERVIDOR = "No se pudo consultar a Moodle en este momento. Intente de nuevo en unos minutos.";

function error(kind, status) {
  const e = new Error(FRASE_DEL_SERVIDOR);
  e.kind = kind;
  if (status) e.status = status;
  return e;
}

async function abrir({ catalogo = CATALOGO, gente = personas(1, 4, 4) } = {}) {
  getCatalogoDeFormacion.mockResolvedValue(catalogo);
  getCompanyMembers.mockResolvedValue(gente);
  render(<TrainingClient />);
  const curso = await screen.findByLabelText(/^Course/);
  fireEvent.change(curso, { target: { value: "7" } });
  await screen.findByText("Nombre1 Apellido");
  return curso;
}

const casilla = (id) => screen.getByRole("checkbox", { name: `Select Nombre${id} Apellido` });
const marcar = (...ids) => ids.forEach((id) => fireEvent.click(casilla(id)));
const botonCubrir = () => screen.getByRole("button", { name: /^Cover \d+ selected$|^Cover the selected people$/ });

beforeEach(() => {
  replace.mockClear();
  isAuthenticated.mockReset().mockReturnValue(true);
  getCatalogoDeFormacion.mockReset();
  cubrirCurso.mockReset();
  dejarDeCubrirCurso.mockReset();
  getCompanyMembers.mockReset();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("elegir un curso y marcar a varias personas", () => {
  it("la accion es UNA sola: un curso, varias personas, una llamada", async () => {
    cubrirCurso.mockResolvedValue({ filas: [fila(1, "covered"), fila(3, "covered"), fila(4, "covered")] });
    await abrir();
    marcar(1, 3, 4);
    fireEvent.click(botonCubrir());
    await waitFor(() => expect(cubrirCurso).toHaveBeenCalledTimes(1));
    expect(cubrirCurso).toHaveBeenCalledWith(7, [1, 3, 4]);
  });

  it("sin sesion redirige a login", () => {
    isAuthenticated.mockReturnValue(false);
    render(<TrainingClient />);
    expect(replace).toHaveBeenCalledWith("/login?next=/settings/admin-company/training");
    expect(getCatalogoDeFormacion).not.toHaveBeenCalled();
  });

  it("no pide la lista de gente hasta que hay un curso elegido", async () => {
    getCatalogoDeFormacion.mockResolvedValue(CATALOGO);
    render(<TrainingClient />);
    await screen.findByLabelText(/^Course/);
    expect(getCompanyMembers).not.toHaveBeenCalled();
    expect(screen.getByText(en.training.chooseCourseFirst)).toBeInTheDocument();
  });

  it("la lista de gente se pide de 10 en 10 (la cobertura cuesta por persona a la vista)", async () => {
    await abrir();
    expect(getCompanyMembers).toHaveBeenCalledWith(expect.objectContaining({ limit: 10, offset: 0 }));
  });
});

describe("quien ya esta cubierto", () => {
  it("se ve como tal y no se puede volver a marcar", async () => {
    cubrirCurso.mockResolvedValue({ filas: [fila(1, "already_covered"), fila(2, "covered")] });
    await abrir();
    marcar(1, 2);
    fireEvent.click(botonCubrir());
    await screen.findByText(en.training.results.title);
    // La lista de personas sigue ahi: las dos quedan como cubiertas y bloqueadas.
    expect(casilla(1)).toBeDisabled();
    expect(casilla(2)).toBeDisabled();
    expect(casilla(3)).not.toBeDisabled();
    const lista = screen.getByRole("list", { name: en.training.peopleTitle });
    expect(within(lista).getAllByText(en.training.coverage.covered)).toHaveLength(2);
  });

  it("al dejar de cubrir, esas mismas personas SI se pueden marcar", async () => {
    cubrirCurso.mockResolvedValue({ filas: [fila(1, "covered")] });
    await abrir();
    marcar(1);
    fireEvent.click(botonCubrir());
    await screen.findByText(en.training.results.title);
    expect(casilla(1)).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: en.training.modeStop }));
    expect(casilla(1)).not.toBeDisabled();
  });
});

describe("el resultado es una fila por persona, no un total", () => {
  it("cada persona sale con su resultado", async () => {
    cubrirCurso.mockResolvedValue({
      filas: [fila(1, "covered"), fila(2, "already_covered"), fila(3, "account_failed", "moodle_no_creo_la_cuenta")],
    });
    await abrir();
    marcar(1, 2, 3);
    fireEvent.click(botonCubrir());
    await screen.findByText(en.training.results.title);
    const tabla = screen.getByRole("table");
    const filas = within(tabla).getAllByRole("row").slice(1);
    expect(filas).toHaveLength(3);
    expect(within(filas[0]).getByText("p1@x.com")).toBeInTheDocument();
    expect(within(filas[0]).getByText(en.training.result.cubrir.covered)).toBeInTheDocument();
    expect(within(filas[1]).getByText(en.training.result.cubrir.already_covered)).toBeInTheDocument();
    expect(within(filas[2]).getByText(en.training.result.cubrir.account_failed)).toBeInTheDocument();
    expect(within(filas[2]).getByText(en.training.detail.moodle_no_creo_la_cuenta)).toBeInTheDocument();
  });

  it("un lote a medias NO se presenta como error: las que entraron, entraron", async () => {
    cubrirCurso.mockResolvedValue({
      filas: [fila(1, "covered"), fila(2, "enrol_failed", "invalidrecord")],
    });
    await abrir();
    marcar(1, 2);
    fireEvent.click(botonCubrir());
    await screen.findByText(en.training.results.title);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText(en.training.result.cubrir.covered)).toBeInTheDocument();
    // un errorcode crudo no se pinta
    expect(screen.queryByText(/invalidrecord/)).toBeNull();
    expect(screen.getByText(en.training.detail.otro)).toBeInTheDocument();
  });

  it("una persona pedida que el servidor no devolvio sale con su propia frase", async () => {
    cubrirCurso.mockResolvedValue({ filas: [fila(1, "covered")] });
    await abrir();
    marcar(1, 2);
    fireEvent.click(botonCubrir());
    await screen.findByText(en.training.results.title);
    expect(screen.getByText(en.training.result.noRow)).toBeInTheDocument();
  });
});

describe("tandas de 10 con avance", () => {
  it("25 personas salen en tandas de 10, 10 y 5, y el avance se muestra", async () => {
    // La 2a tanda se queda en vuelo para poder LEER el avance: si {i, n} se
    // cruzaran saldria "batch 3 of 2".
    let soltarSegunda;
    cubrirCurso.mockImplementation((_c, ids) => {
      const respuesta = { filas: ids.map((i) => fila(i, "covered")) };
      if (cubrirCurso.mock.calls.length === 2) {
        return new Promise((res) => { soltarSegunda = () => res(respuesta); });
      }
      return Promise.resolve(respuesta);
    });
    getCatalogoDeFormacion.mockResolvedValue(CATALOGO);
    getCompanyMembers.mockImplementation(async ({ offset }) =>
      personas(offset + 1, Math.min(10, 25 - offset), 25));
    render(<TrainingClient />);
    fireEvent.change(await screen.findByLabelText(/^Course/), { target: { value: "7" } });
    for (let pag = 0; pag < 3; pag += 1) {
      await screen.findByText(`Nombre${pag * 10 + 1} Apellido`);
      fireEvent.click(screen.getByRole("checkbox", { name: en.training.selectAllPage }));
      if (pag < 2) fireEvent.click(screen.getByRole("button", { name: en.training.page.next }));
    }
    fireEvent.click(botonCubrir());
    expect(await screen.findByText("Sending batch 2 of 3")).toBeInTheDocument();
    soltarSegunda();
    await screen.findByText(en.training.results.title);
    expect(cubrirCurso.mock.calls.map((c) => c[1].length)).toEqual([10, 10, 5]);
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(26);
  });

  it("mientras corre dice en que tanda va", async () => {
    let soltar;
    cubrirCurso.mockImplementation(() => new Promise((res) => { soltar = res; }));
    await abrir();
    marcar(1, 2);
    fireEvent.click(botonCubrir());
    expect(await screen.findByText("Sending batch 1 of 1")).toBeInTheDocument();
    expect(botonCubrir()).toBeDisabled();
    soltar({ filas: [fila(1, "covered"), fila(2, "covered")] });
    await screen.findByText(en.training.results.title);
  });

  it("si una tanda cae por no poder leer (503), las demas NO se envian y quedan pendientes", async () => {
    getCatalogoDeFormacion.mockResolvedValue(CATALOGO);
    getCompanyMembers.mockImplementation(async ({ offset }) =>
      personas(offset + 1, Math.min(10, 12 - offset), 12));
    cubrirCurso.mockImplementation(async (_c, ids) => ({ filas: ids.map((i) => fila(i, "covered")) }));
    cubrirCurso.mockRejectedValueOnce(error("sin_lectura", 503));
    render(<TrainingClient />);
    fireEvent.change(await screen.findByLabelText(/^Course/), { target: { value: "7" } });
    await screen.findByText("Nombre1 Apellido");
    fireEvent.click(screen.getByRole("checkbox", { name: en.training.selectAllPage }));
    fireEvent.click(screen.getByRole("button", { name: en.training.page.next }));
    await screen.findByText("Nombre11 Apellido");
    fireEvent.click(screen.getByRole("checkbox", { name: en.training.selectAllPage }));
    fireEvent.click(botonCubrir());
    await screen.findByText(en.training.results.title);
    expect(cubrirCurso).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert")).toHaveTextContent(en.training.runError.sin_lectura);
    // las 12 siguen ahi, todas "sin enviar", y se pueden reintentar
    expect(screen.getAllByText(en.training.detail.no_se_envio)).toHaveLength(12);
    expect(screen.getByRole("button", { name: "Try again for the 12 not finished" })).toBeInTheDocument();
  });

  it("si la respuesta de una tanda no vuelve (red), esa tanda queda 'por confirmar', no 'rechazada'", async () => {
    cubrirCurso.mockRejectedValueOnce(error("red"));
    await abrir();
    marcar(1, 2);
    fireEvent.click(botonCubrir());
    await screen.findByText(en.training.results.title);
    expect(screen.getAllByText(en.training.detail.sin_respuesta)).toHaveLength(2);
    expect(screen.getAllByText(en.training.results.tipo.incierto).length).toBeGreaterThan(0);
    expect(screen.queryByText(en.training.results.tipo.fallo)).toBeNull();
  });
});

describe("lo que el servidor escribio no se pinta como fallo", () => {
  it("`no_se_intento_por_tiempo` es 'sin enviar', y se reintentan SOLO las pendientes", async () => {
    cubrirCurso
      .mockResolvedValueOnce({
        filas: [
          fila(1, "covered"),
          fila(2, "enrol_failed", "no_se_intento_por_tiempo"),
          fila(3, "enrol_failed", "error_inesperado"),
          fila(4, "account_failed", "moodle_no_creo_la_cuenta"),
        ],
      })
      .mockResolvedValueOnce({ filas: [fila(2, "covered"), fila(3, "already_covered")] });
    await abrir();
    marcar(1, 2, 3, 4);
    fireEvent.click(botonCubrir());
    await screen.findByText(en.training.results.title);

    const tabla = screen.getByRole("table");
    const filas = within(tabla).getAllByRole("row").slice(1);
    expect(within(filas[1]).getByText(en.training.results.tipo.pendiente)).toBeInTheDocument();
    expect(within(filas[1]).queryByText(en.training.results.tipo.fallo)).toBeNull();
    expect(within(filas[2]).getByText(en.training.results.tipo.incierto)).toBeInTheDocument();
    expect(within(filas[3]).getByText(en.training.results.tipo.fallo)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Try again for the 2 not finished" }));
    await waitFor(() => expect(cubrirCurso).toHaveBeenCalledTimes(2));
    expect(cubrirCurso.mock.calls[1]).toEqual([7, [2, 3]]);

    // las reintentadas se actualizan en su sitio; el rechazo de verdad se queda
    await waitFor(() => expect(
      within(screen.getByRole("table")).getAllByText(en.training.results.tipo.ok)).toHaveLength(3));
    expect(screen.getAllByText(en.training.results.tipo.fallo)).toHaveLength(1); // solo la fila 4
    expect(screen.queryByRole("button", { name: /Try again for the/ })).toBeNull();
  });
});

describe("dejar de cubrir", () => {
  it("PIDE CONFIRMACION, y el dialogo dice las tres cosas", async () => {
    dejarDeCubrirCurso.mockResolvedValue({ filas: [fila(1, "uncovered")] });
    const confirmar = vi.spyOn(window, "confirm").mockReturnValue(true);
    await abrir();
    fireEvent.click(screen.getByRole("radio", { name: en.training.modeStop }));
    marcar(1);
    fireEvent.click(screen.getByRole("button", { name: /^Stop covering \d+ selected$/ }));
    // todavia no se hizo nada
    expect(dejarDeCubrirCurso).not.toHaveBeenCalled();
    const dialogo = screen.getByRole("alertdialog");
    expect(within(dialogo).getByText(en.training.confirm.loses)).toBeInTheDocument();
    expect(within(dialogo).getByText(en.training.confirm.keeps)).toBeInTheDocument();
    expect(within(dialogo).getByText(en.training.confirm.reversible)).toBeInTheDocument();
    // en linea: ni confirm() del navegador
    expect(confirmar).not.toHaveBeenCalled();

    fireEvent.click(within(dialogo).getByRole("button", { name: en.training.confirm.yes }));
    await waitFor(() => expect(dejarDeCubrirCurso).toHaveBeenCalledWith(7, [1]));
    expect(cubrirCurso).not.toHaveBeenCalled();
  });

  it("cancelar no toca nada", async () => {
    await abrir();
    fireEvent.click(screen.getByRole("radio", { name: en.training.modeStop }));
    marcar(1);
    fireEvent.click(screen.getByRole("button", { name: /^Stop covering \d+ selected$/ }));
    fireEvent.click(screen.getByRole("button", { name: en.training.confirm.no }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(dejarDeCubrirCurso).not.toHaveBeenCalled();
  });

  it("sus filas se leen con SU vocabulario, no con el de cubrir (nada sale 'desconocido')", async () => {
    dejarDeCubrirCurso.mockResolvedValue({
      filas: [
        fila(1, "uncovered"),
        fila(2, "not_covered"),
        fila(3, "enrol_failed", "moodle_acepto_pero_sigue_activa"),
        fila(4, "enrol_failed", "moodle_acepto_pero_no_pude_releer"),
      ],
    });
    await abrir();
    fireEvent.click(screen.getByRole("radio", { name: en.training.modeStop }));
    marcar(1, 2, 3, 4);
    fireEvent.click(screen.getByRole("button", { name: /^Stop covering \d+ selected$/ }));
    fireEvent.click(screen.getByRole("button", { name: en.training.confirm.yes }));
    await screen.findByText(en.training.results.title);
    expect(screen.getByText(en.training.result.dejar.uncovered)).toBeInTheDocument();
    expect(screen.getByText(en.training.result.dejar.not_covered)).toBeInTheDocument();
    expect(screen.getByText(en.training.detail.moodle_acepto_pero_sigue_activa)).toBeInTheDocument();
    expect(screen.getByText(en.training.detail.moodle_acepto_pero_no_pude_releer)).toBeInTheDocument();
    expect(screen.queryByText(en.training.result.unknown)).toBeNull();
    expect(screen.queryByText(en.training.results.tipo.desconocido)).toBeNull();
    // not_covered NO es un fallo: solo hay 1 rechazo (la fila 3) y 1 por confirmar
    const filas = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(within(filas[1]).getByText(en.training.results.tipo.neutro)).toBeInTheDocument();
    expect(within(filas[3]).getByText(en.training.results.tipo.incierto)).toBeInTheDocument();
  });

  it("al dejar de cubrir las reintentables usan la ruta de dejar, no la de cubrir", async () => {
    dejarDeCubrirCurso
      .mockResolvedValueOnce({ filas: [fila(1, "enrol_failed", "no_se_intento_por_tiempo")] })
      .mockResolvedValueOnce({ filas: [fila(1, "uncovered")] });
    await abrir();
    fireEvent.click(screen.getByRole("radio", { name: en.training.modeStop }));
    marcar(1);
    fireEvent.click(screen.getByRole("button", { name: /^Stop covering \d+ selected$/ }));
    fireEvent.click(screen.getByRole("button", { name: en.training.confirm.yes }));
    fireEvent.click(await screen.findByRole("button", { name: "Try again for the 1 not finished" }));
    await waitFor(() => expect(dejarDeCubrirCurso).toHaveBeenCalledTimes(2));
    expect(cubrirCurso).not.toHaveBeenCalled();
  });
});

describe("cubrir NO pide confirmacion", () => {
  it("es frecuente y reversible: sale directo, sin dialogo ni confirm()", async () => {
    const confirmar = vi.spyOn(window, "confirm").mockReturnValue(true);
    cubrirCurso.mockResolvedValue({ filas: [fila(1, "covered")] });
    await abrir();
    marcar(1);
    fireEvent.click(botonCubrir());
    expect(screen.queryByRole("alertdialog")).toBeNull();
    await waitFor(() => expect(cubrirCurso).toHaveBeenCalled());
    expect(confirmar).not.toHaveBeenCalled();
  });

  it("sin nadie marcado el boton esta apagado", async () => {
    await abrir();
    expect(botonCubrir()).toBeDisabled();
    fireEvent.click(botonCubrir());
    expect(cubrirCurso).not.toHaveBeenCalled();
  });
});

describe("si no se pudo leer, lo dice y NO pinta una lista vacia", () => {
  it("catalogo con 503: mensaje, reintentar, y ni selector ni 'no hay cursos'", async () => {
    getCatalogoDeFormacion.mockRejectedValue(error("sin_lectura", 503));
    render(<TrainingClient />);
    const aviso = await screen.findByRole("alert");
    expect(aviso).toHaveTextContent(en.training.loadError.sin_lectura);
    expect(document.body.textContent).not.toContain("Intente de nuevo");
    expect(screen.queryByLabelText(/^Course/)).toBeNull();
    expect(screen.queryByText(en.training.noCourses)).toBeNull();
    expect(screen.getByRole("button", { name: en.training.retryLoad })).toBeInTheDocument();
  });

  it("reintentar vuelve a pedir y, si ahora llega, muestra los cursos", async () => {
    getCatalogoDeFormacion.mockRejectedValueOnce(error("sin_lectura", 503)).mockResolvedValueOnce(CATALOGO);
    render(<TrainingClient />);
    fireEvent.click(await screen.findByRole("button", { name: en.training.retryLoad }));
    expect(await screen.findByLabelText(/^Course/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("cada tipo de fallo tiene su frase, y ninguna sale del servidor", async () => {
    for (const kind of Object.keys(en.training.loadError)) {
      getCatalogoDeFormacion.mockRejectedValueOnce(error(kind));
      const { unmount } = render(<TrainingClient />);
      expect(await screen.findByRole("alert")).toHaveTextContent(en.training.loadError[kind]);
      unmount();
    }
  });

  it("un catalogo legitimamente sin cursos dice eso, que es OTRA cosa", async () => {
    getCatalogoDeFormacion.mockResolvedValue({ secciones: [], avisos: 0 });
    render(<TrainingClient />);
    expect(await screen.findByText(en.training.noCourses)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("el catalogo trae solo un numero de avisos", () => {
  it("con avisos > 0 dice que puede faltar algo, SIN nombres y SIN el numero", async () => {
    getCatalogoDeFormacion.mockResolvedValue({ ...CATALOGO, avisos: 37 });
    render(<TrainingClient />);
    const nota = await screen.findByText(en.training.avisos);
    // la nota es EXACTAMENTE la frase: ni cifra pegada ni nombres de secciones
    expect(nota.textContent).toBe(en.training.avisos);
    expect(document.body.textContent).not.toMatch(/37/);
    for (const s of CATALOGO.secciones) {
      expect(nota.textContent).not.toContain(s.nombre);
    }
  });

  it("con 0 avisos no pinta nada", async () => {
    getCatalogoDeFormacion.mockResolvedValue(CATALOGO);
    render(<TrainingClient />);
    await screen.findByLabelText(/^Course/);
    expect(screen.queryByText(en.training.avisos)).toBeNull();
  });

  it("los cursos se agrupan por seccion", async () => {
    getCatalogoDeFormacion.mockResolvedValue(CATALOGO);
    render(<TrainingClient />);
    const selector = await screen.findByLabelText(/^Course/);
    expect(within(selector).getByRole("group", { name: "General" })).toBeInTheDocument();
    expect(within(selector).getByRole("option", { name: "House Rules" })).toBeInTheDocument();
  });
});

describe("la palabra Moodle no aparece en ningun estado", () => {
  const sinMoodle = () => expect(document.body.textContent).not.toMatch(/moodle/i);

  it("catalogo cargando, con error, y con avisos", async () => {
    getCatalogoDeFormacion.mockReturnValue(new Promise(() => {}));
    const a = render(<TrainingClient />);
    sinMoodle();
    a.unmount();

    getCatalogoDeFormacion.mockRejectedValue(error("sin_lectura", 503));
    const b = render(<TrainingClient />);
    await screen.findByRole("alert");
    sinMoodle();
    b.unmount();

    getCatalogoDeFormacion.mockResolvedValue({ ...CATALOGO, avisos: 2 });
    render(<TrainingClient />);
    await screen.findByLabelText(/^Course/);
    sinMoodle();
  });

  it("con las filas de TODOS los detalles posibles (cubrir y dejar) y la confirmacion", async () => {
    const todos = Object.keys(en.training.detail);
    const filas = todos.map((d, i) => fila(i + 1, "enrol_failed", d));
    cubrirCurso.mockResolvedValue({ filas });
    dejarDeCubrirCurso.mockResolvedValue({ filas });
    await abrir({ gente: personas(1, todos.length, todos.length) });
    fireEvent.click(screen.getByRole("checkbox", { name: en.training.selectAllPage }));
    fireEvent.click(botonCubrir());
    await screen.findByText(en.training.results.title);
    sinMoodle();

    fireEvent.click(screen.getByRole("radio", { name: en.training.modeStop }));
    fireEvent.click(screen.getByRole("checkbox", { name: en.training.selectAllPage }));
    fireEvent.click(screen.getByRole("button", { name: /^Stop covering \d+ selected$/ }));
    sinMoodle();
    fireEvent.click(screen.getByRole("button", { name: en.training.confirm.yes }));
    await waitFor(() => expect(dejarDeCubrirCurso).toHaveBeenCalled());
    await screen.findByText(en.training.results.title);
    sinMoodle();
  });

  it("ni en la copia en ingles ni en la espanola", () => {
    expect(JSON.stringify(en.training)).not.toMatch(/moodle[^_"]/i);
    expect(JSON.stringify(es.training)).not.toMatch(/moodle[^_"]/i);
    // los unicos 'moodle' permitidos son los NOMBRES de clave del detalle, no su texto
    const valores = (o) => Object.values(o).flatMap((v) => (typeof v === "object" ? valores(v) : [v]));
    for (const v of [...valores(en.training), ...valores(es.training)]) {
      expect(v).not.toMatch(/moodle/i);
    }
  });
});

describe("la copia existe en los dos idiomas", () => {
  const claves = (o, p = "") => Object.entries(o).flatMap(([k, v]) =>
    (typeof v === "object" ? claves(v, `${p}${k}.`) : [`${p}${k}`]));
  it("en y es tienen las mismas claves de `training`", () => {
    expect(claves(es.training).sort()).toEqual(claves(en.training).sort());
  });
});

describe("la cobertura que se aprende al DEJAR de cubrir", () => {
  const modoDejar = () => fireEvent.click(screen.getByRole("radio", { name: en.training.modeStop }));
  const dejar = () => {
    fireEvent.click(screen.getByRole("button", { name: /^Stop covering \d+ selected$/ }));
    fireEvent.click(screen.getByRole("button", { name: en.training.confirm.yes }));
  };
  const estadoDe = (id) => within(casilla(id).closest("li")).getByText(
    new RegExp(`^(${en.training.coverage.covered}|${en.training.coverage.notCovered}|${en.training.coverage.unknown})$`));

  it("tras un uncovered la persona queda SIN cubrir (y bloqueada al dejar, libre al cubrir)", async () => {
    cubrirCurso.mockResolvedValue({ filas: [fila(1, "covered")] });
    dejarDeCubrirCurso.mockResolvedValue({ filas: [fila(1, "uncovered")] });
    await abrir();
    marcar(1);
    fireEvent.click(botonCubrir());
    await screen.findByText(en.training.results.title);
    expect(estadoDe(1)).toHaveTextContent(en.training.coverage.covered);

    modoDejar();
    marcar(1);
    dejar();
    await waitFor(() => expect(dejarDeCubrirCurso).toHaveBeenCalled());
    await waitFor(() => expect(estadoDe(1)).toHaveTextContent(en.training.coverage.notCovered));
    expect(casilla(1)).toBeDisabled();          // ya no hay nada que dejar
    fireEvent.click(screen.getByRole("radio", { name: en.training.modeCover }));
    expect(casilla(1)).not.toBeDisabled();      // y SI se puede volver a cubrir
  });

  it("tras un not_covered tambien queda sin cubrir", async () => {
    dejarDeCubrirCurso.mockResolvedValue({ filas: [fila(2, "not_covered")] });
    await abrir();
    modoDejar();
    marcar(2);
    dejar();
    await waitFor(() => expect(estadoDe(2)).toHaveTextContent(en.training.coverage.notCovered));
  });

  it("una persona que el servidor NO devolvio (sin_fila) no cambia su cobertura: el servidor no dijo nada", async () => {
    dejarDeCubrirCurso.mockResolvedValue({ filas: [fila(1, "uncovered")] }); // la 2 no vuelve
    await abrir();
    modoDejar();
    marcar(1, 2);
    dejar();
    await screen.findByText(en.training.result.noRow);
    expect(estadoDe(1)).toHaveTextContent(en.training.coverage.notCovered);
    expect(estadoDe(2)).toHaveTextContent(en.training.coverage.unknown);
    expect(casilla(2)).not.toBeDisabled();
  });

  it("un enrol_failed al dejar tampoco cambia la cobertura", async () => {
    dejarDeCubrirCurso.mockResolvedValue({ filas: [fila(1, "enrol_failed", "no_se_intento_por_tiempo")] });
    await abrir();
    modoDejar();
    marcar(1);
    dejar();
    await screen.findByText(en.training.results.title);
    expect(estadoDe(1)).toHaveTextContent(en.training.coverage.unknown);
  });
});

describe("las personas desactivadas", () => {
  const gente = () => {
    const g = personas(1, 3, 3);
    g.members[1].active = false; // la 2
    return g;
  };

  it("se pinta su estado EN TEXTO y no se pueden marcar", async () => {
    await abrir({ gente: gente() });
    const fila2 = casilla(2).closest("li");
    expect(within(fila2).getByText(en.companyAdmin.status.deactivated)).toBeInTheDocument();
    expect(casilla(2)).toBeDisabled();
    expect(casilla(1)).not.toBeDisabled();
  });

  it("'seleccionar a todos' las salta y el lote no lleva su id", async () => {
    cubrirCurso.mockResolvedValue({ filas: [fila(1, "covered"), fila(3, "covered")] });
    await abrir({ gente: gente() });
    fireEvent.click(screen.getByRole("checkbox", { name: en.training.selectAllPage }));
    expect(casilla(2)).not.toBeChecked();
    fireEvent.click(botonCubrir());
    await waitFor(() => expect(cubrirCurso).toHaveBeenCalledWith(7, [1, 3]));
  });

  it("tambien al dejar de cubrir (no hay nada que dejar en quien no puede entrar)", async () => {
    await abrir({ gente: gente() });
    fireEvent.click(screen.getByRole("radio", { name: en.training.modeStop }));
    expect(casilla(2)).toBeDisabled();
  });
});

describe("accesibilidad de la lista", () => {
  it("quien no tiene nombre ni correo no deja la casilla con el nombre accesible 'Select '", async () => {
    const g = personas(1, 2, 2);
    g.members[1] = { id: 2, email: "", firstname: "", lastname: "", name: "", active: true };
    await abrir({ gente: g });
    expect(screen.getByRole("checkbox", { name: "Select Person without a name" })).toBeInTheDocument();
  });

  it("al CONFIRMAR dejar de cubrir el foco no cae al body", async () => {
    dejarDeCubrirCurso.mockReturnValue(new Promise(() => {}));
    await abrir();
    fireEvent.click(screen.getByRole("radio", { name: en.training.modeStop }));
    marcar(1);
    fireEvent.click(screen.getByRole("button", { name: /^Stop covering \d+ selected$/ }));
    fireEvent.click(screen.getByRole("button", { name: en.training.confirm.yes }));
    await waitFor(() => expect(dejarDeCubrirCurso).toHaveBeenCalled());
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: en.training.peopleTitle }));
  });

  it("dos secciones con el MISMO nombre no chocan (sin aviso de clave repetida)", async () => {
    const espia = vi.spyOn(console, "error").mockImplementation(() => {});
    getCatalogoDeFormacion.mockResolvedValue({
      secciones: [
        { nombre: "General", cursos: [{ moodle_course_id: 7, nombre: "A" }] },
        { nombre: "General", cursos: [{ moodle_course_id: 8, nombre: "B" }] },
      ],
      avisos: 0,
    });
    render(<TrainingClient />);
    await screen.findByLabelText(/^Course/);
    const claves = espia.mock.calls.filter((c) => /same key/i.test(String(c[0])));
    expect(claves).toHaveLength(0);
    expect(screen.getByRole("option", { name: "B" })).toBeInTheDocument();
  });
});
