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
 *   - dashboard/trainy → acción Entrenar (SSO).
 *   - dashboard/dash   → es el panel del Tablero mismo (no se enlaza).
 *   - settings/language→ se sustituye por el control de idioma inline.
 *   - resto            → navegación a /coming-soon (En construcción).
 * @param {string} url
 * @returns {{type:"train"}|{type:"dash"}|{type:"language"}|{type:"route",href:string}}
 */
export function resolveMenuTarget(url) {
  const key = String(url || "").replace(/^\//, "");
  if (key === "dashboard/trainy") return { type: "train" };
  if (key === "dashboard/dash") return { type: "dash" };
  if (key === "settings/language") return { type: "language" };
  return { type: "route", href: "/coming-soon" };
}
