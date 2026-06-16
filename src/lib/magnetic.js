/**
 * Efecto magnético opcional para CTAs. Off por defecto: se activa montando
 * attachMagnetic() sobre un elemento. Parametrizable por strength.
 * Usa named handlers (CLAUDE.md §5.4). Respeta reduced-motion (no monta).
 */

import { motion } from "./motion";

/** Offset puro (px) a aplicar al elemento dado el puntero y su rect. */
export function magneticOffset(pointerX, pointerY, rect, strength) {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  return { x: (pointerX - cx) * strength, y: (pointerY - cy) * strength };
}

/**
 * Activa el efecto sobre un elemento. Devuelve una función de limpieza.
 * @param {HTMLElement} el
 * @param {{strength?:number}} [opts]
 */
export function attachMagnetic(el, { strength = motion.magnetic.strength } = {}) {
  if (!el) return () => {};
  if (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return () => {};
  }

  function onMove(e) {
    const rect = el.getBoundingClientRect();
    const { x, y } = magneticOffset(e.clientX, e.clientY, rect, strength);
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  }
  function onLeave() {
    el.style.transform = "translate(0, 0)";
  }

  el.addEventListener("mousemove", onMove);
  el.addEventListener("mouseleave", onLeave);
  return () => {
    el.removeEventListener("mousemove", onMove);
    el.removeEventListener("mouseleave", onLeave);
  };
}
