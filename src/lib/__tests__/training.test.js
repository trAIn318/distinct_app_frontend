import { describe, it, expect } from "vitest";
import { clasificarFila, reintentables, TAMANO_DE_TANDA } from "../training";

const fila = (resultado, detalle = null) => ({ usr_id: 1, email: "a@x.com", resultado, detalle });

describe("clasificarFila de CUBRIR", () => {
  it.each([
    ["covered", null, "ok"],
    ["already_covered", null, "ok"],
    ["account_created", null, "ok"],
    ["account_failed", "moodle_no_creo_la_cuenta", "fallo"],
    ["account_failed", "la_persona_no_tiene_correo", "fallo"],
    ["enrol_failed", "roleid_de_estudiante_no_configurado", "fallo"],
    ["enrol_failed", "invalidrecord", "fallo"],
  ])("%s / %s es %s", (resultado, detalle, tipo) => {
    expect(clasificarFila("cubrir", fila(resultado, detalle)).tipo).toBe(tipo);
  });

  it("`no_se_intento_por_tiempo` es PENDIENTE (reintente), no un fallo", () => {
    expect(clasificarFila("cubrir", fila("enrol_failed", "no_se_intento_por_tiempo")).tipo).toBe("pendiente");
  });

  it.each(["error_inesperado", "moodle_acepto_pero_no_lo_confirma"])(
    "`%s` es INCIERTO: puede que ya este matriculada",
    (detalle) => {
      expect(clasificarFila("cubrir", fila("enrol_failed", detalle)).tipo).toBe("incierto");
    });
});

describe("clasificarFila de DEJAR DE CUBRIR (vocabulario propio)", () => {
  it("uncovered es ok, y not_covered es NEUTRO, no un fallo", () => {
    expect(clasificarFila("dejar", fila("uncovered")).tipo).toBe("ok");
    expect(clasificarFila("dejar", fila("not_covered")).tipo).toBe("neutro");
  });

  it("los siete `detalle` de enrol_failed se distinguen entre si", () => {
    const esperado = {
      no_se_intento_por_tiempo: "pendiente",
      moodle_no_respondio_al_leer_sus_cursos: "pendiente",
      moodle_acepto_pero_no_pude_releer: "incierto",
      error_inesperado: "incierto",
      roleid_de_estudiante_no_configurado: "fallo",
      la_persona_no_tiene_correo: "fallo",
      moodle_acepto_pero_sigue_activa: "fallo",
    };
    for (const [detalle, tipo] of Object.entries(esperado)) {
      expect(clasificarFila("dejar", fila("enrol_failed", detalle)).tipo, detalle).toBe(tipo);
    }
    const claves = Object.keys(esperado).map(
      (d) => clasificarFila("dejar", fila("enrol_failed", d)).detalleKey);
    expect(new Set(claves).size).toBe(claves.length);
  });

  it("un resultado de cubrir NO es valido al dejar de cubrir (y al reves)", () => {
    expect(clasificarFila("dejar", fila("covered")).tipo).toBe("desconocido");
    expect(clasificarFila("cubrir", fila("uncovered")).tipo).toBe("desconocido");
  });
});

describe("los detalles que fabrica la pantalla", () => {
  it("`no_se_envio` es pendiente y `sin_respuesta` es incierta", () => {
    expect(clasificarFila("cubrir", fila("enrol_failed", "no_se_envio")).tipo).toBe("pendiente");
    expect(clasificarFila("dejar", fila("enrol_failed", "sin_respuesta")).tipo).toBe("incierto");
  });
});

describe("reintentables", () => {
  it("son las pendientes y las inciertas, y NO los rechazos de verdad", () => {
    const filas = [
      fila("covered"),
      { ...fila("enrol_failed", "no_se_intento_por_tiempo"), usr_id: 2 },
      { ...fila("enrol_failed", "error_inesperado"), usr_id: 3 },
      { ...fila("account_failed", "moodle_no_creo_la_cuenta"), usr_id: 4 },
    ];
    expect(reintentables("cubrir", filas)).toEqual([2, 3]);
  });
});

it("la tanda es de 10: el tope de 50 del servidor es la red, no el camino", () => {
  expect(TAMANO_DE_TANDA).toBe(10);
});

it("una persona pedida que el servidor no devolvio (`sin_fila`) no es 'desconocida' ni se reintenta", () => {
  const f = { usr_id: 9, email: "z@x.com", resultado: "sin_fila", detalle: null };
  for (const accion of ["cubrir", "dejar"]) {
    const c = clasificarFila(accion, f);
    expect(c.tipo).toBe("neutro");
    expect(c.resultadoKey).toBe("result.noRow");
    expect(reintentables(accion, [f])).toEqual([]);
  }
});
