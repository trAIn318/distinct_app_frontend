import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const getAccessToken = vi.fn();
vi.mock("../session", () => ({ getAccessToken: (...a) => getAccessToken(...a) }));

import {
  getCatalogoDeFormacion,
  cubrirCurso,
  dejarDeCubrirCurso,
} from "../api";

let fetchMock;

function respuesta(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

beforeEach(() => {
  getAccessToken.mockReset().mockReturnValue("tok-123");
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

function ultimaLlamada() {
  const [url, opts] = fetchMock.mock.calls.at(-1);
  return { url, opts: opts || {} };
}

/** Lo que lanza la funcion, o `null` si no lanza. */
async function falla(promesa) {
  try {
    await promesa;
    return null;
  } catch (e) {
    return e;
  }
}

const CATALOGO = { secciones: [{ nombre: "General", cursos: [{ moodle_course_id: 7, nombre: "Servicio" }] }], avisos: 0 };

describe("las rutas y el cuerpo", () => {
  it("getCatalogoDeFormacion: GET al catalogo con el token", async () => {
    fetchMock.mockResolvedValue(respuesta(CATALOGO));
    const r = await getCatalogoDeFormacion();
    expect(r).toEqual(CATALOGO);
    const { url, opts } = ultimaLlamada();
    expect(url).toMatch(/\/api\/company-admin\/training\/catalog\/$/);
    expect(opts.method || "GET").toBe("GET");
    expect(opts.headers.Authorization).toBe("Bearer tok-123");
  });

  it("cubrirCurso: POST a /cover/ con course_id y usr_ids", async () => {
    fetchMock.mockResolvedValue(respuesta({ filas: [] }));
    await cubrirCurso(7, [1, 2]);
    const { url, opts } = ultimaLlamada();
    expect(url).toMatch(/\/training\/cover\/$/);
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual({ course_id: 7, usr_ids: [1, 2] });
  });

  it("dejarDeCubrirCurso: POST a /uncover/, y NO a /cover/", async () => {
    fetchMock.mockResolvedValue(respuesta({ filas: [] }));
    await dejarDeCubrirCurso(7, [3]);
    const { url, opts } = ultimaLlamada();
    expect(url).toMatch(/\/training\/uncover\/$/);
    expect(url).not.toMatch(/\/cover\/$/);
    expect(JSON.parse(opts.body)).toEqual({ course_id: 7, usr_ids: [3] });
  });
});

describe("un lote parcial es un resultado, no un error", () => {
  it("200 con filas mixtas devuelve las filas tal cual", async () => {
    const filas = [
      { usr_id: 1, email: "a@x.com", resultado: "covered", detalle: null },
      { usr_id: 2, email: "b@x.com", resultado: "enrol_failed", detalle: "no_se_intento_por_tiempo" },
    ];
    fetchMock.mockResolvedValue(respuesta({ filas }));
    expect(await cubrirCurso(7, [1, 2])).toEqual({ filas });
  });
});

describe("los fallos se distinguen por ESTADO, nunca por el texto", () => {
  const TEXTOS = ["", "cualquier cosa", "No se pudo consultar a Moodle en este momento."];

  it.each(TEXTOS)("503 siempre es `sin_lectura`, con el texto %j", async (detail) => {
    for (const fn of [
      () => getCatalogoDeFormacion(),
      () => cubrirCurso(7, [1]),
      () => dejarDeCubrirCurso(7, [1]),
    ]) {
      fetchMock.mockResolvedValue(respuesta(detail ? { detail } : {}, { ok: false, status: 503 }));
      const e = await falla(fn());
      expect(e.kind).toBe("sin_lectura");
      expect(e.status).toBe(503);
    }
  });

  it("400 es `pedido`, 401 y 403 son `sesion` y `permiso`, el resto `generico`", async () => {
    const casos = [[400, "pedido"], [401, "sesion"], [403, "permiso"], [500, "generico"], [504, "generico"]];
    for (const [status, kind] of casos) {
      fetchMock.mockResolvedValue(respuesta({ detail: "x" }, { ok: false, status }));
      expect((await falla(cubrirCurso(7, [1]))).kind).toBe(kind);
    }
  });

  it("el mensaje del Error NO lleva el texto del servidor (nombra a Moodle)", async () => {
    fetchMock.mockResolvedValue(respuesta(
      { detail: "No se pudo consultar a Moodle en este momento." }, { ok: false, status: 503 }));
    const e = await falla(getCatalogoDeFormacion());
    expect(e.message).not.toMatch(/moodle/i);
  });

  it("sin red (fetch rechaza) es `red`, sin estado", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const e = await falla(getCatalogoDeFormacion());
    expect(e.kind).toBe("red");
    expect(e.status).toBeUndefined();
  });
});

describe("un 200 que no tiene la forma esperada NO es un exito", () => {
  it("catalogo sin `secciones` (cuerpo vacio del proxy) es `ilegible`", async () => {
    fetchMock.mockResolvedValue(respuesta({}));
    expect((await falla(getCatalogoDeFormacion())).kind).toBe("ilegible");
  });

  it("catalogo con `avisos` que no es numero es `ilegible`", async () => {
    fetchMock.mockResolvedValue(respuesta({ secciones: [], avisos: "2" }));
    expect((await falla(getCatalogoDeFormacion())).kind).toBe("ilegible");
  });

  it("cubrir sin `filas` es `ilegible`, no 'cero filas'", async () => {
    fetchMock.mockResolvedValue(respuesta({}));
    expect((await falla(cubrirCurso(7, [1]))).kind).toBe("ilegible");
    expect((await falla(dejarDeCubrirCurso(7, [1]))).kind).toBe("ilegible");
  });
});
