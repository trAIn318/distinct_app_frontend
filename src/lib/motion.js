/**
 * Defaults globales de animación + helpers puros.
 * Cambiar un default aquí afecta a toda la app; cada componente puede
 * sobreescribir vía props. Los valores visuales viven como tokens CSS
 * (tokens.css); aquí van los que necesita el JS.
 */

export const easings = {
  easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
  easeOutExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  linear: (t) => t,
};

/** Defaults de cada efecto (override por props en los componentes). */
export const motion = {
  counter: { durationMs: 2200, easing: "easeOutCubic" },
  reactive: { trigger: "both", durationMs: 500 }, // visual real vive en CSS tokens
  magnetic: { strength: 0.3, radius: 120 },
};

/** Valor del contador para un progreso 0..1 dado, redondeado a entero. */
export function countAt(target, progress, easingFn) {
  const p = Math.min(Math.max(progress, 0), 1);
  return Math.round(easingFn(p) * target);
}

/** Formatea un número con separador de miles + prefijo/sufijo opcionales. */
export function formatNumber(value, { prefix = "", suffix = "" } = {}) {
  return `${prefix}${value.toLocaleString("en-US")}${suffix}`;
}
