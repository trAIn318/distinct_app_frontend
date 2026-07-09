/**
 * Donut — anillo de progreso circular inline-SVG (sin librerías externas,
 * requerido por la CSP estricta del proyecto). Pinta un track platinum (no
 * charcoal: --color-charcoal se invierte a blanco en tema claro y el track
 * quedaría invisible sobre fondos claros) y un arco gold que crece con
 * `percent` (0..100), con el número centrado en
 * --font-label (números en mono, per claude.md §4). Geometría fija: círculo
 * de radio DONUT_RADIUS (src/lib/eval.js) — el tamaño visual se controla
 * escalando el <svg> vía CSS (width/height), no cambiando el radio.
 */

import { donutArc, DONUT_RADIUS } from "../lib/eval";
import styles from "./Donut.module.css";

// viewBox cuadrado con margen igual al grosor de trazo (STROKE) a cada lado,
// así el anillo no se recorta contra el borde del SVG.
const STROKE = 3;
const SIZE = (DONUT_RADIUS + STROKE) * 2;
const CENTER = SIZE / 2;

export default function Donut({ percent, size = 96, className = "" }) {
  const value = Number.isFinite(Number(percent)) ? Number(percent) : 0;
  const clamped = Math.min(100, Math.max(0, value));
  const { dashArray, dashOffset } = donutArc(clamped);

  return (
    <div
      className={`${styles.donut} ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${Math.round(clamped)}%`}
    >
      <svg
        className={styles.svg}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        aria-hidden="true"
      >
        {/* Track — círculo completo en platinum, siempre visible de fondo */}
        <circle
          className={styles.track}
          cx={CENTER}
          cy={CENTER}
          r={DONUT_RADIUS}
          strokeWidth={STROKE}
          fill="none"
        />
        {/* Progreso — arco gold, recortado vía dasharray/dashoffset */}
        <circle
          className={styles.progress}
          cx={CENTER}
          cy={CENTER}
          r={DONUT_RADIUS}
          strokeWidth={STROKE}
          fill="none"
          strokeDasharray={dashArray}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${CENTER} ${CENTER})`}
        />
      </svg>
      <span className={styles.label}>{Math.round(clamped)}%</span>
    </div>
  );
}
