/**
 * src/lib/homeSections.js
 * Catálogo parametrizable de las secciones de la home.
 *
 * La home ya NO se compone con JSX hardcodeado: se arma a partir de esta lista
 * de datos. Para quitar/reordenar una sección se edita este array (código) o,
 * sin tocar código, se define la env var NEXT_PUBLIC_HOME_SECTIONS con las keys
 * a mostrar (CSV). Ej: NEXT_PUBLIC_HOME_SECTIONS="hero,featuredCourses,contact".
 *
 * Este módulo es PURO (sin imports de componentes) para poder testearlo. El
 * mapa key→componente vive en app/page.js.
 */

// Orden canónico de la home. Cada key se mapea a un componente en page.js.
export const DEFAULT_HOME_SECTIONS = [
  "hero",
  "valueProp",
  "problemApproach",
  "featuredCourses",
  "testimonials",
  "platformOverview",
  "howItWorks",
  "aria",
  "contact",
  "partners",
];

/**
 * Devuelve las secciones habilitadas, en el orden canónico.
 * - Sin env var → todas las secciones.
 * - Con NEXT_PUBLIC_HOME_SECTIONS → solo las keys presentes (las keys
 *   desconocidas se ignoran; el orden SIEMPRE es el canónico, no el del CSV,
 *   para evitar layouts rotos por reordenamientos accidentales).
 *
 * @param {string} [rawEnv] valor crudo de la env var (inyectable para tests)
 * @returns {string[]}
 */
export function getEnabledHomeSections(rawEnv = process.env.NEXT_PUBLIC_HOME_SECTIONS) {
  if (!rawEnv || !String(rawEnv).trim()) return DEFAULT_HOME_SECTIONS;
  const allow = new Set(
    String(rawEnv)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
  return DEFAULT_HOME_SECTIONS.filter((key) => allow.has(key));
}
