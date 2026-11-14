import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const getAccessToken = vi.fn();
vi.mock("../session", () => ({ getAccessToken: (...a) => getAccessToken(...a) }));

import {
  getDashboardCourses,
  getCatalogoDeMembresia,
  guardarCatalogoDeMembresia,
  startTraining,
} from "../api";

let fetchMock;

function respuesta(body, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) };
}

beforeEach(() => {
  getAccessToken.mockReset().mockReturnValue("tok-123");
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function ultimaLlamada() {
  const [url, opts] = fetchMock.mock.calls.at(-1);
  return { url, opts: opts || {} };
}

describe("getDashboardCourses y el 402 por membresia", () => {
  it("reconoce el 402 por el BOOLEANO membership_required, no por el texto", async () => {
    // El texto del backend ya cambio una vez; el booleano es el contrato.
    fetchMock.mockResolvedValue(respuesta({
      detail: "An active membership is required to access the courses.",
      membership_required: true,
      estado_suscripcion: "plan_ajeno",
      desde: "2026-11-01T00:00:00+00:00",
    }, { ok: false, status: 402 }));
    const datos = await getDashboardCourses();
    expect(datos.membership_required).toBe(true);
    expect(datos.estado_suscripcion).toBe("plan_ajeno");
    // `desde` llega en el cuerpo pero ninguna pantalla lo usa: no se propaga en
    // ninguna de las dos puertas, para que las dos formas sigan siendo espejo.
    expect(datos).not.toHaveProperty("desde");
    expect(datos.courses).toEqual([]);
  });

  it("un 402 sin el booleano NO se cuenta como membresia: sigue siendo la lista vacia", async () => {
    fetchMock.mockResolvedValue(respuesta({ detail: "Payment required." }, { ok: false, status: 402 }));
    const datos = await getDashboardCourses();
    expect(datos.membership_required).toBeUndefined();
    expect(datos).toEqual({ courses: [], moodle_linked: false });
  });

  it("cualquier otro fallo sigue siendo la lista vacia (best-effort de siempre)", async () => {
    fetchMock.mockResolvedValue(respuesta({}, { ok: false, status: 502 }));
    expect(await getDashboardCourses()).toEqual({ courses: [], moodle_linked: false });
    fetchMock.mockRejectedValue(new Error("red caida"));
    expect(await getDashboardCourses()).toEqual({ courses: [], moodle_linked: false });
  });
});

describe("startTraining y el 402 por membresia (la otra puerta)", () => {
  it("propaga el estado y el booleano del cuerpo, no solo el texto", async () => {
    fetchMock.mockResolvedValue(respuesta({
      detail: "An active membership is required to access the courses.",
      membership_required: true,
      estado_suscripcion: "plan_ajeno",
      desde: "2026-11-01T00:00:00+00:00",
    }, { ok: false, status: 402 }));
    await expect(startTraining()).rejects.toMatchObject({
      status: 402, membershipRequired: true, estadoSuscripcion: "plan_ajeno",
    });
  });

  it("un 402 sin el booleano no se marca como membresia", async () => {
    fetchMock.mockResolvedValue(respuesta({ detail: "Payment required." }, { ok: false, status: 402 }));
    await expect(startTraining()).rejects.toMatchObject({ status: 402 });
    await expect(startTraining()).rejects.not.toMatchObject({ membershipRequired: true });
  });

  it("los demas fallos siguen llevando el estado y el detail de siempre", async () => {
    fetchMock.mockResolvedValue(respuesta({ detail: "Moodle account not found." }, { ok: false, status: 404 }));
    await expect(startTraining()).rejects.toMatchObject({
      status: 404, message: "Moodle account not found.",
    });
  });
});

describe("el catalogo de la membresia", () => {
  it("getCatalogoDeMembresia pide el endpoint de la consola con la sesion", async () => {
    fetchMock.mockResolvedValue(respuesta({
      cursos: [], incluidos: 0,
      incluidos_sin_curso_en_moodle: [], incluidos_ocultos_en_moodle: [],
    }));
    await getCatalogoDeMembresia();
    const { url, opts } = ultimaLlamada();
    expect(url).toContain("/api/pay/admin/catalogo/");
    expect(opts.headers.Authorization).toBe("Bearer tok-123");
    expect(opts.method === undefined || opts.method === "GET").toBe(true);
  });

  it("guardarCatalogoDeMembresia manda la seleccion COMPLETA con PUT", async () => {
    fetchMock.mockResolvedValue(respuesta({ cursos: [], incluidos: 2 }));
    await guardarCatalogoDeMembresia([12, 20]);
    const { url, opts } = ultimaLlamada();
    expect(url).toContain("/api/pay/admin/catalogo/");
    expect(opts.method).toBe("PUT");
    expect(JSON.parse(opts.body)).toEqual({ moodle_course_ids: [12, 20] });
  });

  it("un 400 por curso oculto llega con su motivo y la lista de cursos", async () => {
    // El frontend tiene que poder NOMBRAR el curso culpable; sin estos campos
    // solo le quedaria la prosa en español del backend.
    fetchMock.mockResolvedValue(respuesta({
      detail: "En Moodle estos cursos estan ocultos: 55 (Room Service).",
      motivo: "curso_oculto",
      cursos_ocultos: [55],
    }, { ok: false, status: 400 }));
    await expect(guardarCatalogoDeMembresia([55])).rejects.toMatchObject({
      status: 400, motivo: "curso_oculto", cursosOcultos: [55],
    });
  });

  it("un 400 por curso desconocido llega con su motivo y sus ids", async () => {
    fetchMock.mockResolvedValue(respuesta({
      detail: "Moodle no reporta esos cursos.",
      motivo: "curso_desconocido",
      cursos_desconocidos: [9],
    }, { ok: false, status: 400 }));
    await expect(guardarCatalogoDeMembresia([9])).rejects.toMatchObject({
      status: 400, motivo: "curso_desconocido", cursosDesconocidos: [9],
    });
  });

  it("un 503 de Moodle llega con su motivo para poder decir que fue Moodle", async () => {
    fetchMock.mockResolvedValue(respuesta({
      detail: "Moodle no respondio la lista de cursos.",
      motivo: "moodle_no_responde",
    }, { ok: false, status: 503 }));
    await expect(getCatalogoDeMembresia()).rejects.toMatchObject({
      status: 503, motivo: "moodle_no_responde",
    });
  });
});
