/**
 * MenuIcon — icono inline (SVG) para una opción de menú, resuelto desde el
 * string que guarda la BD (p.ej. ":material/bar_chart:"). Es data-driven: si el
 * nombre no está en el diccionario cae a un icono genérico, así una opción nueva
 * (o renombrada) en la BD igual se pinta sin romper nada. Ampliar la cobertura =
 * agregar una entrada a GLYPHS. Trazo fino, hereda el color (currentColor) para
 * respetar los tokens del tema.
 */

import { parseIconName } from "../lib/menuTargets";

// Glifos como fragmentos SVG (viewBox 0 0 24 24). Cubren el grupo DASHBOARD.
const GLYPHS = {
  bar_chart: (
    <>
      <line x1="6" y1="20" x2="6" y2="12" />
      <line x1="12" y1="20" x2="12" y2="5" />
      <line x1="18" y1="20" x2="18" y2="14" />
    </>
  ),
  quiz: (
    <>
      <path d="M9.6 9.2a2.4 2.4 0 1 1 3.3 2.2c-.9.5-1.4 1-1.4 2.1" />
      <circle cx="11.5" cy="17" r="0.6" fill="currentColor" stroke="none" />
    </>
  ),
  shopping_cart: (
    <>
      <circle cx="9" cy="20" r="1.1" />
      <circle cx="18" cy="20" r="1.1" />
      <path d="M2.5 3.5H5l2.3 11a1 1 0 0 0 1 .8h8.1a1 1 0 0 0 1-.78L20.5 8H6" />
    </>
  ),
  person: (
    <>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
    </>
  ),
};

// Fallback neutro para iconos aún no mapeados (rombo pequeño).
const FALLBACK = <rect x="6.5" y="6.5" width="11" height="11" rx="1.5" transform="rotate(45 12 12)" />;

export default function MenuIcon({ icon, className }) {
  const name = parseIconName(icon);
  const glyph = GLYPHS[name] || FALLBACK;
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {glyph}
    </svg>
  );
}
