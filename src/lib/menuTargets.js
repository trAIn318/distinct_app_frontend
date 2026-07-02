/**
 * src/lib/menuTargets.js
 * Lógica pura de reparto y mapeo del menú por rol (de GET /api/menu/).
 * Sin dependencias de React ni de red: fácil de testear.
 */

/**
 * Reparte los items del menú en sus tres grupos conocidos.
 * Grupos desconocidos y entradas nulas se ignoran de forma segura.
 * @param {Array<{group?:string,url?:string,title?:string}>} items
 * @returns {{dashboard:Array,recruiter:Array,settings:Array}}
 */
export function splitMenuByGroup(items) {
  const buckets = { dashboard: [], recruiter: [], settings: [] };
  for (const item of items || []) {
    const group = String(item?.group || "").toLowerCase();
    if (group === "dashboard") buckets.dashboard.push(item);
    else if (group === "recruiter") buckets.recruiter.push(item);
    else if (group === "settings") buckets.settings.push(item);
  }
  return buckets;
}

/**
 * Traduce el `url` (page) de un item de menú a un comportamiento del frontend.
 * Registro de comportamientos: solo las opciones con pantalla/acción propia se
 * tratan especial; TODO lo demás (dashboard/dash, eval, pay y opciones futuras)
 * cae a /coming-soon y se renderiza igual, data-driven, con su título e icono de
 * la BD. Así, renombrar "Dash"→"Statistics" o agregar una opción nueva en la BD
 * NO requiere tocar el frontend.
 *   - dashboard/trainy → acción Entrenar (SSO).
 *   - settings/language→ se sustituye por el control de idioma inline.
 *   - resto            → navegación a /coming-soon (En construcción).
 * @param {string} url
 * @returns {{type:"train"}|{type:"language"}|{type:"route",href:string}}
 */
export function resolveMenuTarget(url) {
  const key = String(url || "").replace(/^\//, "");
  if (key === "dashboard/trainy") return { type: "train" };
  if (key === "settings/language") return { type: "language" };
  return { type: "route", href: "/coming-soon" };
}

/**
 * Normaliza el nombre de icono que guarda la BD al identificador de Material
 * Symbols. Acepta ":material/bar_chart:", "material/bar_chart" o "bar_chart".
 * Devuelve "" si no hay icono (el consumidor decide el fallback).
 * @param {string} raw
 * @returns {string}
 */
export function parseIconName(raw) {
  const s = String(raw || "");
  const m = s.match(/material\/([a-z0-9_]+)/i);
  if (m) return m[1].toLowerCase();
  return s.replace(/[:\s]/g, "").toLowerCase();
}
