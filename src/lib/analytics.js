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

/** Agrupa la serie diaria por día de semana (0=Domingo … 6=Sábado), sumando
 *  net_sales. Devuelve 7 buckets en orden Dom→Sáb. Parseo de fecha seguro
 *  ante zona horaria (construye la fecha local por partes). */
export function salesByWeekday(daily) {
  const buckets = Array.from({ length: 7 }, (_, dow) => ({ dow, net: 0 }));
  for (const d of daily || []) {
    if (!d || !d.date) continue;
    const [y, m, day] = String(d.date).split("-").map(Number);
    if (!y || !m || !day) continue;
    const dow = new Date(y, m - 1, day).getDay(); // local, 0=Dom..6=Sáb
    buckets[dow].net += Number(d.net_sales) || 0;
  }
  return buckets;
}

/** Agrupa la serie diaria por mes ("YYYY-MM") sumando net_sales. Ordenado
 *  cronológicamente. Seguro ante zona horaria (usa el prefijo del texto de la
 *  fecha, sin construir Date). Vacío/null → []. */
export function monthlySales(daily) {
  const map = new Map();
  for (const d of daily || []) {
    if (!d || !d.date) continue;
    const month = String(d.date).slice(0, 7); // "YYYY-MM"
    if (month.length !== 7) continue;
    map.set(month, (map.get(month) || 0) + (Number(d.net_sales) || 0));
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([month, net]) => ({ month, net }));
}

/** Variación % (1 decimal) del último mes vs. el anterior. null si <2 meses
 *  o si el mes anterior es 0. */
export function monthOverMonthPct(monthly) {
  if (!monthly || monthly.length < 2) return null;
  const prev = monthly[monthly.length - 2].net;
  const last = monthly[monthly.length - 1].net;
  if (!prev) return null;
  return Math.round(((last - prev) / prev) * 1000) / 10;
}

/** Plantilla CSV de Ventas (formato del reporte diario de Toast) para descargar:
 *  header real + una fila de ejemplo para que el cliente sepa el formato. */
export function salesTemplateCsv() {
  return [
    "yyyyMMdd,Net sales,Total orders,Total guests",
    "20260506,1345.50,24,39",
  ].join("\n");
}
