/**
 * src/lib/eval.js
 * Lógica pura del módulo de Evaluaciones (quiz + donut de progreso).
 * Sin dependencias de React ni de red: fácil de testear.
 */

/** Radio (px, en el viewBox del SVG) del anillo del <Donut>. Fijo a propósito:
 *  el componente escala visualmente vía CSS/viewBox, no cambiando geometría. */
export const DONUT_RADIUS = 16;

/** Circunferencia del círculo de radio DONUT_RADIUS: C = 2 * PI * r. */
export const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

/**
 * Calcula stroke-dasharray/stroke-dashoffset para dibujar un arco de
 * progreso sobre un <circle> de radio DONUT_RADIUS.
 *
 * Técnica estándar de "donut chart" con SVG: el trazo del círculo se
 * divide en un patrón de guiones igual a la circunferencia completa
 * (dashArray = C, es decir "un solo guion" del largo de todo el círculo),
 * y se desplaza (dashOffset) para ocultar la porción que NO corresponde
 * al porcentaje. offset = C -> todo oculto (0%); offset = 0 -> nada
 * oculto, círculo completo visible (100%).
 *
 * @param {number} percent - 0..100 (se clampea; no numérico -> 0)
 * @returns {{dashArray: number, dashOffset: number}}
 */
export function donutArc(percent) {
  const p = Number.isFinite(Number(percent)) ? Number(percent) : 0;
  const clamped = Math.min(100, Math.max(0, p));
  const dashArray = DONUT_CIRCUMFERENCE;
  const dashOffset = DONUT_CIRCUMFERENCE * (1 - clamped / 100);
  return { dashArray, dashOffset };
}

/**
 * Decide si un tipo de pregunta de Moodle se muestra como selección
 * múltiple (checkboxes) o única (radio). No sabemos del lado del cliente
 * cuántas respuestas correctas tiene una "multichoice" (puede ser 1 o más),
 * así que tratamos TODO "multichoice" como checkbox por seguridad; el resto
 * (p.ej. "truefalse") es de selección única.
 * @param {string} qtype
 * @returns {boolean}
 */
export function isMultiSelect(qtype) {
  return qtype === "multichoice";
}
