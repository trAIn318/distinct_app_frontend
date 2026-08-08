# Fase 1 — Panel de análisis (Frontend) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El panel visual de ventas: KPIs con delta, tendencia (línea), comparativa por propiedad (barras) y tabla+CSV, consumiendo `GET /api/analytics/reports/sales/`. Reestructura: `/dashboard/analytics` pasa a ser el Panel; la carga se mueve a `/dashboard/analytics/upload`.

**Architecture:** Next.js App Router (JS, CSS Modules). Página servidor (`getT`) + client component con guard de auth, filtros, y `getSalesReport`. Gráficas con **Recharts** en componentes cliente aislados. Sigue el patrón del módulo `eval` y el sistema de diseño del repo (`CLAUDE.md`).

**Tech Stack:** Next.js 16 / React 19, CSS Modules, i18n JSON (`useT`/`getT`), Recharts, Vitest + @testing-library/react. Backend ya en prod (`/api/analytics/reports/sales/`).

## Global Constraints

- Trabajar SOLO en `distinct_app_frontend`. No tocar el backend.
- **Sistema de diseño (`CLAUDE.md`):** design tokens (colores obsidiana/marfil/oro), esquinas rectas, `.btn-primary`, `prefers-reduced-motion`. Gráficas Recharts tematizadas con los tokens (no dejar la paleta por defecto de la lib). Aplicar la guía de la skill `dataviz` para colores/labels/accesibilidad al construir las gráficas.
- **i18n:** todo texto por i18n (`useT("analytics")` / `getT("analytics")`), claves nuevas en en.json Y es.json. Nunca renderizar la palabra "Moodle".
- **Auth:** guard como `EvalClient` → `router.replace("/login?next=<ruta>")`. La autorización real la hace el backend; el frontend muestra estados/errores.
- **Contrato del endpoint** (`GET /api/analytics/reports/sales/?start=&end=&property_id=`) → devuelve:
  ```
  { "range": {"start": "YYYY-MM-DD"|null, "end": ...|null},
    "currencies": [ { "currency": "USD",
      "kpis": {"net_sales":"0.00","order_count":0,"guest_count":0,"avg_ticket":"0.00"},
      "delta_pct": {"net_sales":12.5|null,"order_count":..,"guest_count":..,"avg_ticket":..},
      "daily": [ {"date":"YYYY-MM-DD","net_sales":"0.00","order_count":0,"guest_count":0} ],
      "by_property": [ {"property_id":1,"property_name":"..","net_sales":"0.00","order_count":0,"guest_count":0} ] } ] }
  ```
  Alcance vacío / sin datos → `currencies: []`. Montos son strings.
- **Comando de tests:** `npx vitest run <ruta>` desde `distinct_app_frontend`. (Node no está afectado por SAC.)

---

### Task 1: Capa de datos — `getSalesReport` + helpers de CSV/formato + tests

**Files:**
- Modify: `src/lib/api.js` (añadir `getSalesReport`)
- Modify: `src/lib/analytics.js` (añadir `buildSalesCsv`, `formatDeltaPct`)
- Test: `src/lib/__tests__/analytics.test.js` (añadir casos)

**Interfaces:**
- Consumes: `authFetch` (privada en api.js), `API_URL`, `getAccessToken`.
- Produces: `getSalesReport({start,end,propertyId}) -> Promise<report>`; `buildSalesCsv(daily) -> string`; `formatDeltaPct(pct) -> string` (para Tasks 3-4).

- [ ] **Step 1: Añadir tests que fallan** — en `src/lib/__tests__/analytics.test.js`:

```js
import { buildSalesCsv, formatDeltaPct } from "../analytics";

describe("buildSalesCsv", () => {
  it("arma CSV con encabezado y filas", () => {
    const daily = [
      { date: "2026-05-06", net_sales: "100.00", order_count: 10, guest_count: 15 },
      { date: "2026-05-07", net_sales: "300.00", order_count: 30, guest_count: 45 },
    ];
    const csv = buildSalesCsv(daily);
    expect(csv).toBe(
      "date,net_sales,order_count,guest_count\n" +
      "2026-05-06,100.00,10,15\n" +
      "2026-05-07,300.00,30,45"
    );
  });
  it("solo encabezado si no hay filas", () => {
    expect(buildSalesCsv([])).toBe("date,net_sales,order_count,guest_count");
    expect(buildSalesCsv(null)).toBe("date,net_sales,order_count,guest_count");
  });
});

describe("formatDeltaPct", () => {
  it("formatea positivo, negativo y cero con signo", () => {
    expect(formatDeltaPct(12.5)).toBe("▲ 12.5%");
    expect(formatDeltaPct(-8)).toBe("▼ 8%");
    expect(formatDeltaPct(0)).toBe("0%");
  });
  it("devuelve cadena vacía si es null/undefined", () => {
    expect(formatDeltaPct(null)).toBe("");
    expect(formatDeltaPct(undefined)).toBe("");
  });
});
```

- [ ] **Step 2: Correr para ver fallar**

Run: `npx vitest run src/lib/__tests__/analytics.test.js`
Expected: FAIL — `buildSalesCsv`/`formatDeltaPct` no existen.

- [ ] **Step 3: Implementar helpers** — añadir a `src/lib/analytics.js`:

```js
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
```

- [ ] **Step 4: Añadir `getSalesReport`** — al final del bloque de analytics en `src/lib/api.js`:

```js
/** GET /api/analytics/reports/sales/ — reporte agregado del panel. */
export async function getSalesReport({ start, end, propertyId } = {}) {
  const qs = new URLSearchParams();
  if (start) qs.set("start", start);
  if (end) qs.set("end", end);
  if (propertyId && propertyId !== "all") qs.set("property_id", propertyId);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return authFetch(`/analytics/reports/sales/${suffix}`);
}
```

- [ ] **Step 5: Correr tests** — `npx vitest run src/lib/__tests__/analytics.test.js` → PASS.

- [ ] **Step 6: Commit**
```bash
git add src/lib/analytics.js src/lib/api.js src/lib/__tests__/analytics.test.js
git commit -m "feat(analytics-fe): getSalesReport + helpers de CSV/delta para el panel"
```

---

### Task 2: Reestructura de rutas — mover la carga a `/dashboard/analytics/upload`

**Files:**
- Move: `src/app/dashboard/analytics/page.js` → `src/app/dashboard/analytics/upload/page.js`
- Move: `src/app/dashboard/analytics/AnalyticsUploadClient.js` → `src/app/dashboard/analytics/upload/AnalyticsUploadClient.js`
- Move: `src/app/dashboard/analytics/page.module.css` → `src/app/dashboard/analytics/upload/page.module.css`
- Move: `src/app/dashboard/analytics/__tests__/AnalyticsUploadClient.test.js` → `src/app/dashboard/analytics/upload/__tests__/AnalyticsUploadClient.test.js`
- Modify: `src/app/dashboard/analytics/properties/PropertiesClient.js` (back-link)

**Interfaces:** ninguna nueva; la carga queda en `/dashboard/analytics/upload` y sigue funcionando. (Tras este task, `/dashboard/analytics` queda sin página hasta la Task 3 — estado transitorio dentro de la sesión SDD.)

- [ ] **Step 1: Mover los 4 archivos** a la carpeta `upload/` (git mv o crear/borrar). La carpeta `upload/__tests__/` para el test.

- [ ] **Step 2: Ajustar la profundidad de imports** (ahora bajan un nivel más):
- En `upload/AnalyticsUploadClient.js`: `../../../lib/...` → `../../../../lib/...`; `../../../i18n/client` → `../../../../i18n/client`. (`./page.module.css` se queda.)
- En `upload/page.js`: `../../../i18n/server` → `../../../../i18n/server`; el import de `./AnalyticsUploadClient` se queda.
- En `upload/__tests__/AnalyticsUploadClient.test.js`: los mocks suben un nivel más — `../../../../lib/session` → `../../../../../lib/session`, `../../../../lib/api` → `../../../../../lib/api`; el import `../AnalyticsUploadClient` se queda.

- [ ] **Step 3: Ajustar enlaces cruzados:**
- En `upload/AnalyticsUploadClient.js`, el enlace a "Mis propiedades" (`href="/dashboard/analytics/properties"`) se queda. Añadir (si no está) un enlace "Volver al panel" → `href="/dashboard/analytics"` con la clave i18n `backToPanel` (agregar la clave en Task 3).
- En `properties/PropertiesClient.js` (línea ~326), el back-link apunta a `/dashboard/analytics` con la etiqueta `t("uploadTitle")`; cambiar la etiqueta a `t("backToPanel")` (sigue apuntando a `/dashboard/analytics`, que ahora es el Panel). Añadir además un enlace a "Cargar ventas" → `/dashboard/analytics/upload` con `t("uploadTitle")`.

- [ ] **Step 4: Correr el test movido + suite** — `npx vitest run src/app/dashboard/analytics/upload/__tests__/AnalyticsUploadClient.test.js` (PASS) y `npx vitest run` (sin regresiones). Nota: la clave i18n `backToPanel` puede no existir aún; si el test falla por eso, agrégala mínima en en.json/es.json aquí o difiérela a Task 3 (donde se agregan las claves del panel) — preferible agregarla ya para dejar el test verde.

- [ ] **Step 5: Commit**
```bash
git add src/app/dashboard/analytics/
git commit -m "refactor(analytics-fe): mueve la carga a /dashboard/analytics/upload"
```

---

### Task 3: Panel de análisis (sin gráficas) — KPIs + filtros + tabla/CSV

**Files:**
- Create: `src/app/dashboard/analytics/page.js` (server, Panel)
- Create: `src/app/dashboard/analytics/PanelClient.js` (client)
- Create: `src/app/dashboard/analytics/page.module.css`
- Modify: `src/i18n/messages/en.json` y `es.json` (claves del panel)
- Test: `src/app/dashboard/analytics/__tests__/PanelClient.test.js`

**Interfaces:**
- Consumes: `getSalesReport`, `getProperties` (para el filtro de propiedad), `buildSalesCsv`, `formatDeltaPct` (Task 1); `isAuthenticated`, `useT`.
- Produces: ruta `/dashboard/analytics` = Panel. Un `<div id o data-testid>` contenedor por moneda que la Task 4 rellenará con las gráficas.

**Comportamiento:**
1. Guard: sin sesión → `router.replace("/login?next=/dashboard/analytics")`.
2. Al montar: carga `getProperties()` (para el selector de propiedad) y `getSalesReport()` (rango por defecto). Guard `cancelled` en el efecto de montaje.
3. **Filtros:** inputs de fecha `start`/`end` (`<input type="date">`) + selector de propiedad ("Todas" o una del alcance) → al cambiar, recarga `getSalesReport({start,end,propertyId})`.
4. Por cada moneda en `report.currencies` (una sección; si hay varias, varias secciones con su rótulo de moneda):
   - **KPIs:** 4 tarjetas (Ventas netas, Órdenes, Comensales, Ticket promedio) con su `delta_pct` vía `formatDeltaPct` (clase verde/roja/neutra; sin delta si `""`).
   - **Contenedor de gráficas:** dos `<div>` placeholder con `data-testid="trend-<currency>"` y `data-testid="byprop-<currency>"` (Task 4 monta las gráficas ahí). La comparativa se oculta si `by_property.length <= 1`.
   - **Tabla de detalle:** filas de `daily` (fecha, netas, órdenes, comensales) + botón **Descargar CSV** (usa `buildSalesCsv` + `Blob`/`URL.createObjectURL`, nombre `ventas_<currency>_<start>_<end>.csv`).
5. Estados: cargando, error (`err.message`), y **vacío** ("No hay ventas en este periodo") cuando `currencies` está vacío.
6. Enlaces a "Cargar ventas" (`/upload`) y "Mis propiedades" (`/properties`).

**Claves i18n a añadir (namespace `analytics`, en+es):** `panelTitle, filters, from, to, allProperties, kpiNetSales, kpiOrders, kpiGuests, kpiAvgTicket, vsPrevPeriod, trendTitle, byPropertyTitle, detailTitle, downloadCsv, emptyPeriod, backToPanel, loading, unavailable`.

- [ ] **Step 1: Escribir el test que falla** — `src/app/dashboard/analytics/__tests__/PanelClient.test.js`:

```js
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
const isAuthenticated = vi.fn();
vi.mock("../../../../lib/session", () => ({ isAuthenticated: (...a) => isAuthenticated(...a) }));
const getSalesReport = vi.fn();
const getProperties = vi.fn();
vi.mock("../../../../lib/api", () => ({
  getSalesReport: (...a) => getSalesReport(...a),
  getProperties: (...a) => getProperties(...a),
}));

import PanelClient from "../PanelClient";

afterEach(cleanup);
beforeEach(() => {
  replace.mockClear(); isAuthenticated.mockReset();
  getSalesReport.mockReset(); getProperties.mockReset();
});

const REPORT = {
  range: { start: "2026-05-06", end: "2026-05-07" },
  currencies: [{
    currency: "USD",
    kpis: { net_sales: "500.00", order_count: 50, guest_count: 80, avg_ticket: "10.00" },
    delta_pct: { net_sales: 12.5, order_count: null, guest_count: 0, avg_ticket: -4 },
    daily: [{ date: "2026-05-06", net_sales: "100.00", order_count: 10, guest_count: 15 }],
    by_property: [{ property_id: 1, property_name: "P1", net_sales: "500.00", order_count: 50, guest_count: 80 }],
  }],
};

describe("PanelClient", () => {
  it("redirige a login sin sesión", () => {
    isAuthenticated.mockReturnValue(false);
    render(<PanelClient />);
    expect(replace).toHaveBeenCalledWith("/login?next=/dashboard/analytics");
  });

  it("muestra KPIs del reporte", async () => {
    isAuthenticated.mockReturnValue(true);
    getProperties.mockResolvedValue([{ id: 1, name: "P1", active: true, comp_id: 1, company_name: "C" }]);
    getSalesReport.mockResolvedValue(REPORT);
    render(<PanelClient />);
    await waitFor(() => expect(screen.getByText("500.00")).toBeInTheDocument());
    expect(screen.getByText("50")).toBeInTheDocument();      // órdenes
    expect(screen.getByText("10.00")).toBeInTheDocument();   // ticket promedio
  });

  it("muestra estado vacío cuando no hay currencies", async () => {
    isAuthenticated.mockReturnValue(true);
    getProperties.mockResolvedValue([]);
    getSalesReport.mockResolvedValue({ range: { start: null, end: null }, currencies: [] });
    render(<PanelClient />);
    await waitFor(() => expect(screen.getByText(/no hay ventas|no sales/i)).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Correr para ver fallar** — `npx vitest run src/app/dashboard/analytics/__tests__/PanelClient.test.js` → FAIL (no existe `../PanelClient`).

- [ ] **Step 3: Crear `page.js`** (patrón eval, server):
```jsx
import PanelClient from "./PanelClient";
import { getT } from "../../../i18n/server";
import styles from "./page.module.css";

export const metadata = {
  title: "Sales dashboard | Distinct Hospitality Solutions",
  description: "Sales analytics dashboard.",
};

export default async function AnalyticsPanelPage() {
  const t = await getT("analytics");
  return (
    <div className={styles.page}>
      <div className={`container ${styles.wrapper}`}>
        <h1 className={styles.h1}>{t("panelTitle")}</h1>
        <PanelClient />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Crear `PanelClient.js`** — client component con el comportamiento 1-6. Sigue el patrón de `AnalyticsUploadClient` (guard, `useT("analytics")`, hooks, `cancelled`, try/catch `err.message`). Estructura de referencia (los detalles de estilo salen del CSS module):

```jsx
"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getSalesReport, getProperties } from "../../../lib/api";
import { isAuthenticated } from "../../../lib/session";
import { buildSalesCsv, formatDeltaPct } from "../../../lib/analytics";
import { useT } from "../../../i18n/client";
import styles from "./page.module.css";

export default function PanelClient() {
  const t = useT("analytics");
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [properties, setProperties] = useState([]);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [propertyId, setPropertyId] = useState("all");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isAuthenticated()) { router.replace("/login?next=/dashboard/analytics"); return; }
    setReady(true);
  }, [router]);

  const load = useCallback(async (opts) => {
    setLoading(true); setError(null);
    try {
      const data = await getSalesReport(opts || {});
      setReport(data);
      if (data?.range?.start && !opts) { setStart(data.range.start); setEnd(data.range.end); }
    } catch (err) { setError(err.message || t("unavailable")); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    getProperties().then((list) => { if (!cancelled) setProperties(list); }).catch(() => {});
    load();  // rango por defecto
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  if (!ready) return null;

  function applyFilters() {
    load({ start: start || undefined, end: end || undefined, propertyId });
  }

  function downloadCsv(cur) {
    const csv = buildSalesCsv(cur.daily);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ventas_${cur.currency}_${report?.range?.start || ""}_${report?.range?.end || ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const currencies = report?.currencies || [];

  return (
    <section className={styles.panel}>
      {/* Filtros */}
      <div className={styles.filters}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t("from")}</span>
          <input className={styles.input} type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t("to")}</span>
          <input className={styles.input} type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t("filters")}</span>
          <select className={styles.select} value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
            <option value="all">{t("allProperties")}</option>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <button type="button" className="btn-primary" onClick={applyFilters}>{t("filters")}</button>
      </div>

      {error && <div className={styles.error} role="alert">{error}</div>}
      {loading ? (
        <p className={styles.muted}>{t("loading")}</p>
      ) : currencies.length === 0 ? (
        <p className={styles.muted}>{t("emptyPeriod")}</p>
      ) : (
        currencies.map((cur) => (
          <div key={cur.currency} className={styles.currencyBlock}>
            {currencies.length > 1 && <h2 className={styles.cardTitle}>{cur.currency}</h2>}

            {/* KPIs */}
            <div className={styles.kpiRow}>
              {[
                ["kpiNetSales", cur.kpis.net_sales, cur.delta_pct.net_sales],
                ["kpiOrders", cur.kpis.order_count, cur.delta_pct.order_count],
                ["kpiGuests", cur.kpis.guest_count, cur.delta_pct.guest_count],
                ["kpiAvgTicket", cur.kpis.avg_ticket, cur.delta_pct.avg_ticket],
              ].map(([labelKey, value, delta]) => (
                <div key={labelKey} className={styles.kpiCard}>
                  <span className={styles.kpiLabel}>{t(labelKey)}</span>
                  <span className={styles.kpiValue}>{value}</span>
                  {formatDeltaPct(delta) && (
                    <span className={delta > 0 ? styles.deltaUp : delta < 0 ? styles.deltaDown : styles.deltaFlat}>
                      {formatDeltaPct(delta)} <span className={styles.muted}>{t("vsPrevPeriod")}</span>
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Gráficas (las monta la Task 4) */}
            <div className={styles.chart} data-testid={`trend-${cur.currency}`} />
            {cur.by_property.length > 1 && (
              <div className={styles.chart} data-testid={`byprop-${cur.currency}`} />
            )}

            {/* Tabla + CSV */}
            <div className={styles.tableHeader}>
              <h3 className={styles.cardTitle}>{t("detailTitle")}</h3>
              <button type="button" className={styles.ghostButton} onClick={() => downloadCsv(cur)}>
                {t("downloadCsv")}
              </button>
            </div>
            <table className={styles.table}>
              <thead>
                <tr><th>{t("from")}</th><th>{t("kpiNetSales")}</th><th>{t("kpiOrders")}</th><th>{t("kpiGuests")}</th></tr>
              </thead>
              <tbody>
                {cur.daily.map((d) => (
                  <tr key={d.date}>
                    <td>{d.date}</td><td>{d.net_sales}</td><td>{d.order_count}</td><td>{d.guest_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}

      <div className={styles.panelFooter}>
        <a className={styles.link} href="/dashboard/analytics/upload">{t("uploadTitle")}</a>
        <a className={styles.link} href="/dashboard/analytics/properties">{t("managePropertiesLink")}</a>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Crear `page.module.css`** (tokens; espejo/estilo de `upload/page.module.css`; clases: `.page,.wrapper,.h1,.panel,.filters,.field,.fieldLabel,.input,.select,.error,.muted,.currencyBlock,.cardTitle,.kpiRow,.kpiCard,.kpiLabel,.kpiValue,.deltaUp,.deltaDown,.deltaFlat,.chart,.tableHeader,.table,.ghostButton,.panelFooter,.link`). Esquinas rectas, `prefers-reduced-motion`. `.kpiRow` en grid/flex responsive; `.table` con `overflow-x:auto` en contenedor.

- [ ] **Step 6: Añadir claves i18n** (namespace `analytics`, en.json y es.json) — todas las listadas arriba (`panelTitle`="Sales dashboard"/"Panel de ventas", `emptyPeriod`="No sales in this period"/"No hay ventas en este periodo", `vsPrevPeriod`="vs. previous period"/"vs. periodo anterior", etc.). Reusar `uploadTitle`, `managePropertiesLink`, `loading`, `unavailable` ya existentes.

- [ ] **Step 7: Correr test + suite** — `npx vitest run src/app/dashboard/analytics/__tests__/PanelClient.test.js` (PASS) y `npx vitest run` (sin regresiones).

- [ ] **Step 8: Commit**
```bash
git add src/app/dashboard/analytics/page.js src/app/dashboard/analytics/PanelClient.js src/app/dashboard/analytics/page.module.css src/i18n/messages/en.json src/i18n/messages/es.json
git commit -m "feat(analytics-fe): panel de analisis (KPIs+delta, filtros, tabla+CSV)"
```

---

### Task 4: Gráficas con Recharts (tendencia + comparativa)

**Files:**
- Modify: `package.json` / `package-lock.json` (añadir `recharts`)
- Create: `src/components/analytics/SalesTrendChart.js`
- Create: `src/components/analytics/SalesByPropertyChart.js`
- Modify: `src/app/dashboard/analytics/PanelClient.js` (renderizar las gráficas en los contenedores)
- Test: `src/components/analytics/__tests__/charts.test.js`

**Interfaces:**
- Consumes: `report.currencies[].daily` (línea) y `by_property` (barras).
- Produces: `<SalesTrendChart data={daily} />`, `<SalesByPropertyChart data={by_property} />`.

- [ ] **Step 1: Instalar Recharts**

Run: `npm install recharts`
Si npm falla por conflicto de peer-deps con React 19, reintentar: `npm install recharts --legacy-peer-deps` y anotarlo en el reporte. Verificar que quedó en `dependencies` de `package.json`. (Si Recharts resultara incompatible con React 19 tras 2 intentos, PARAR y reportar BLOCKED — el controlador decidirá fallback a SVG a mano con la skill `dataviz`.)

- [ ] **Step 2: Escribir el test que falla** — `src/components/analytics/__tests__/charts.test.js`:

```js
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import SalesTrendChart from "../SalesTrendChart";
import SalesByPropertyChart from "../SalesByPropertyChart";

afterEach(cleanup);

describe("charts", () => {
  it("SalesTrendChart monta sin romper con datos", () => {
    const { container } = render(
      <div style={{ width: 600, height: 300 }}>
        <SalesTrendChart data={[{ date: "2026-05-06", net_sales: "100.00" }]} />
      </div>
    );
    expect(container).toBeTruthy();
  });
  it("SalesByPropertyChart monta sin romper con datos", () => {
    const { container } = render(
      <div style={{ width: 600, height: 300 }}>
        <SalesByPropertyChart data={[{ property_name: "P1", net_sales: "100.00" }]} />
      </div>
    );
    expect(container).toBeTruthy();
  });
  it("no rompe con datos vacíos", () => {
    render(<SalesTrendChart data={[]} />);
    render(<SalesByPropertyChart data={[]} />);
  });
});
```

- [ ] **Step 3: Correr para ver fallar** — `npx vitest run src/components/analytics/__tests__/charts.test.js` → FAIL (no existen los componentes).

- [ ] **Step 4: Crear los componentes** (client, Recharts, tematizados con tokens). Convierten `net_sales` string→Number para el eje. Ejemplo `SalesTrendChart.js`:

```jsx
"use client";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";

const GOLD = "#C9A96E";      // var(--color-gold)
const SMOKE = "#6E6E73";     // var(--color-smoke)

export default function SalesTrendChart({ data }) {
  const rows = (data || []).map((d) => ({ date: d.date, net: Number(d.net_sales) }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
        <CartesianGrid stroke={SMOKE} strokeOpacity={0.2} vertical={false} />
        <XAxis dataKey="date" stroke={SMOKE} tick={{ fontSize: 12 }} />
        <YAxis stroke={SMOKE} tick={{ fontSize: 12 }} width={64} />
        <Tooltip />
        <Line type="monotone" dataKey="net" stroke={GOLD} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

`SalesByPropertyChart.js` análogo con `BarChart`/`Bar` (`dataKey="net"`, `XAxis dataKey="property_name"`, barras en `GOLD`). Usar la skill `dataviz` para paleta/labels/accesibilidad (colores desde los tokens, no la paleta por defecto).

- [ ] **Step 5: Integrar en `PanelClient.js`** — importar los componentes y renderizarlos dentro de los contenedores (reemplazar los `<div data-testid=...>` placeholder de la Task 3 por el contenedor con la gráfica adentro), con su título (`t("trendTitle")` / `t("byPropertyTitle")`). La comparativa solo si `by_property.length > 1`.

- [ ] **Step 6: Correr test + suite** — `npx vitest run src/components/analytics/__tests__/charts.test.js` (PASS) y `npx vitest run` (sin regresiones). Si Recharts imprime warnings de `ResponsiveContainer` con width/height 0 en jsdom, envolver en el test con un div dimensionado (ya hecho) o mockear `ResponsiveContainer`; mantener la salida limpia.

- [ ] **Step 7: Commit**
```bash
git add package.json package-lock.json src/components/analytics/ src/app/dashboard/analytics/PanelClient.js
git commit -m "feat(analytics-fe): graficas de tendencia y por propiedad (Recharts)"
```

---

### Task 5: Verificación de la suite completa

- [ ] **Step 1:** `npx vitest run` → PASS (sin romper eval/menuTargets/upload/properties/panel/charts). Salida limpia.
- [ ] **Step 2:** (Si algo falla) diagnosticar y corregir sin marcar completa con tests en rojo.

---

## Notas de despliegue
Ninguna del lado de datos (el endpoint ya está en prod). El botón "Ventas" del Tablero ya apunta a `/dashboard/analytics`, que ahora es el Panel — sin cambios de menú. Al mergear + desplegar Vercel, el panel queda vivo.

## Fuera de alcance (v1)
Agrupación semanal/mensual en la tendencia · export PDF · acceso de solo-lectura para Editores · métricas de gross · caché.
