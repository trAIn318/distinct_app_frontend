/**
 * src/lib/analytics.js
 * Lógica pura del módulo de analytics (propiedades + carga). Sin red ni React.
 */

/** Compañías únicas (por comp_id) presentes en la lista de propiedades.
 *  Sirve para el selector de compañía del owner (ve varias compañías). */
export function deriveCompanies(properties) {
  const map = new Map();
  for (const p of properties || []) {
    if (p && p.comp_id != null && !map.has(p.comp_id)) {
      map.set(p.comp_id, { comp_id: p.comp_id, company_name: p.company_name || "" });
    }
  }
  return [...map.values()];
}

/** Solo propiedades activas (para el desplegable de carga). */
export function activeProperties(properties) {
  return (properties || []).filter((p) => p && p.active);
}

/** ¿El nombre de archivo es un formato aceptado (zip o csv)? */
export function isAcceptedFile(filename) {
  return /\.(zip|csv)$/i.test(String(filename || ""));
}

/** CSV (string) del detalle diario para descargar. Encabezado fijo + filas. */
export function buildSalesCsv(daily) {
  const header = "date,net_sales,order_count,guest_count";
  const rows = (daily || []).map(
    (d) => `${d.date},${d.net_sales},${d.order_count},${d.guest_count}`
  );
  return [header, ...rows].join("\n");
}

/** Etiqueta de delta con flecha y signo. null/undefined -> "". */
export function formatDeltaPct(pct) {
  if (pct === null || pct === undefined) return "";
  if (pct > 0) return `▲ ${pct}%`;
  if (pct < 0) return `▼ ${Math.abs(pct)}%`;
  return "0%";
}
