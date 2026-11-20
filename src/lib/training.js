/**
 * Lo que la pantalla de formación sabe de las filas que devuelve el backend.
 *
 * Cubrir y dejar de cubrir tienen vocabularios DISTINTOS de resultado:
 *   cubrir        covered · already_covered · account_created · account_failed · enrol_failed
 *   dejar cubrir  uncovered · not_covered · enrol_failed
 * Leer uno con el diccionario del otro pinta "desconocido" en filas reales
 * (`covered` mentiría al suspender), así que la acción viaja en cada llamada.
 *
 * Seis tipos, y la diferencia entre ellos es lo que se le dice al jefe:
 *   ok          se hizo.
 *   neutro      no había nada que hacer (no es un fallo).
 *   pendiente   NO se tocó (se agotó el tiempo, o no se pudo leer): reintentar.
 *   incierto    el servidor escribió o pudo escribir: puede estar YA hecho.
 *               Reintentar es seguro, porque matricular es idempotente.
 *   fallo       un rechazo de verdad. Reintentar no lo arregla solo.
 *   desconocido un código que esta pantalla no conoce; se dice sin inventar.
 */

/** Personas por petición. El servidor acepta 50, pero MEDIDO un lote de 50 llega
 *  a 203 llamadas y 174 s contra un corte a los 180 s; uno de 10 son ~21
 *  llamadas y ~18 s. El tope de 50 es la red, no el camino normal. */
export const TAMANO_DE_TANDA = 10;

/** Detalles que fabrica la propia pantalla (el servidor no los manda):
 *  - `no_se_envio`: la tanda nunca salió, o el servidor dijo que no pudo leer;
 *    no se escribió nada.
 *  - `sin_respuesta`: la tanda salió y no volvió respuesta; pudo escribirse. */
export const DET_NO_SE_ENVIO = "no_se_envio";
export const DET_SIN_RESPUESTA = "sin_respuesta";

const DETALLES = {
  no_se_intento_por_tiempo: "pendiente",
  [DET_NO_SE_ENVIO]: "pendiente",
  moodle_no_respondio_al_leer_sus_cursos: "pendiente",
  error_inesperado: "incierto",
  moodle_acepto_pero_no_lo_confirma: "incierto",
  moodle_acepto_pero_no_pude_releer: "incierto",
  [DET_SIN_RESPUESTA]: "incierto",
  roleid_de_estudiante_no_configurado: "fallo",
  la_persona_no_tiene_correo: "fallo",
  moodle_no_creo_la_cuenta: "fallo",
  moodle_acepto_pero_sigue_activa: "fallo",
};

const RESULTADOS = {
  cubrir: { covered: "ok", already_covered: "ok", account_created: "ok" },
  dejar: { uncovered: "ok", not_covered: "neutro" },
};

/** Resultados que llevan su motivo en `detalle`, por acción. */
const CON_DETALLE = {
  cubrir: new Set(["account_failed", "enrol_failed"]),
  dejar: new Set(["enrol_failed"]),
};

/**
 * @param {"cubrir"|"dejar"} accion
 * @returns {{tipo: string, resultadoKey: string, detalleKey: string|null}}
 *   claves relativas al namespace `training`.
 */
export function clasificarFila(accion, fila) {
  const resultado = fila && fila.resultado;
  const propios = RESULTADOS[accion] || {};
  if (Object.hasOwn(propios, resultado)) {
    return { tipo: propios[resultado], resultadoKey: `result.${accion}.${resultado}`, detalleKey: null };
  }
  if (CON_DETALLE[accion] && CON_DETALLE[accion].has(resultado)) {
    const detalle = fila.detalle;
    const conocido = typeof detalle === "string" && Object.hasOwn(DETALLES, detalle);
    return {
      tipo: conocido ? DETALLES[detalle] : "fallo",
      resultadoKey: `result.${accion}.${resultado}`,
      // Un `errorcode` crudo (p. ej. `invalidrecord`) no se pinta: el jefe no
      // puede hacer nada con él. Cae a la frase genérica.
      detalleKey: `detail.${conocido ? detalle : "otro"}`,
    };
  }
  return { tipo: "desconocido", resultadoKey: "result.unknown", detalleKey: null };
}

/** Los `usr_id` que vale la pena reintentar: pendientes e inciertas. */
export function reintentables(accion, filas) {
  return filas
    .filter((f) => {
      const { tipo } = clasificarFila(accion, f);
      return tipo === "pendiente" || tipo === "incierto";
    })
    .map((f) => f.usr_id);
}
