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

// ── Por sede: una empresa con varias sedes ─────────────────────────────────
//
// El negocio real de este cliente NO son grupos de compañías: es UNA compañía
// —Mucura, por ejemplo— con varias sedes. El backend ya devuelve `by_property`
// con ventas, órdenes y comensales por sede, pero **sin ticket promedio y sin
// participación**, y la única tabla del panel es por FECHA. Estas dos funciones
// son lo que faltaba para leer "cuánto hizo cada sede" junto a "cuánto hizo la
// compañía".

const PROPERTY_CSV_HEADER =
  "property,net_sales,order_count,guest_count,avg_ticket,share_pct";

function _fijo(n, decimales) {
  return (Number.isFinite(n) ? n : 0).toFixed(decimales);
}

/** Ticket promedio de una sede. El backend lo calcula igual (ventas/órdenes)
 *  pero no lo manda por sede. Con CERO órdenes devuelve "0.00" en vez de
 *  dividir: ventas sin órdenes contadas es un dato posible del export real, y
 *  un Infinity se pintaría literalmente en la tabla.
 *
 *  Medido por mutación: quitar este guard NO rompe ninguna prueba, porque
 *  `_fijo` ya descarta Infinity y NaN. O sea que es defensa en profundidad y no
 *  la única barrera; se deja porque dice la intención en el sitio donde ocurre
 *  la división, pero quien toque `_fijo` tiene que saber que esto depende de
 *  su `Number.isFinite`. */
function _ticket(ventas, ordenes) {
  const o = Number(ordenes);
  if (!o) return "0.00";
  return _fijo(Number(ventas) / o, 2);
}

/** Campo de CSV. `buildSalesCsv` no necesita esto porque solo escribe fechas y
 *  números; aquí entra el NOMBRE de la sede, y una coma en "Mucura, Centro"
 *  partiría la fila en dos columnas y desplazaría todo lo demás. */
function _campoCsv(valor) {
  const s = String(valor ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Filas de la tabla por sede, más una fila de TOTAL al final.
 *
 * El total es el KPI del backend, **no la suma de las filas**: cada
 * `net_sales` llega ya redondeado a dos decimales, así que sumarlos puede dar
 * un centavo distinto del KPI que el panel pinta arriba, y dos totales que se
 * contradicen en la misma pantalla es peor que un redondeo invisible.
 *
 * Sin sedes devuelve lista vacía: una fila de total sola, sin nada que
 * totalizar, afirmaría que hay datos donde no hay.
 */
export function buildPropertyRows(byProperty, kpis) {
  const sedes = Array.isArray(byProperty) ? byProperty : [];
  if (sedes.length === 0) return [];
  const k = kpis || {};
  const totalNeto = Number(k.net_sales);
  const filas = sedes.map((s) => ({
    property_id: s.property_id,
    // Una sede sin nombre se identifica por su id: en blanco no se puede
    // distinguir de otra sin nombre.
    property_name: s.property_name || `#${s.property_id}`,
    net_sales: String(s.net_sales ?? "0.00"),
    order_count: s.order_count ?? 0,
    guest_count: s.guest_count ?? 0,
    avg_ticket: _ticket(s.net_sales, s.order_count),
    share_pct: totalNeto
      ? _fijo((Number(s.net_sales) / totalNeto) * 100, 1)
      : "0.0",
    is_total: false,
  }));
  filas.push({
    property_id: null,
    property_name: "",
    net_sales: String(k.net_sales ?? "0.00"),
    order_count: k.order_count ?? 0,
    guest_count: k.guest_count ?? 0,
    avg_ticket: String(k.avg_ticket ?? _ticket(k.net_sales, k.order_count)),
    share_pct: "100.0",
    is_total: true,
  });
  return filas;
}

/** CSV de la tabla por sede, con el total incluido. */
export function buildPropertyCsv(rows) {
  const filas = (Array.isArray(rows) ? rows : []).map((f) =>
    [
      f.is_total ? "TOTAL" : f.property_name,
      f.net_sales,
      f.order_count,
      f.guest_count,
      f.avg_ticket,
      f.share_pct,
    ]
      .map(_campoCsv)
      .join(",")
  );
  return [PROPERTY_CSV_HEADER, ...filas].join("\n");
}
