# Fase 1.1 — Gráficas por propiedad (día de semana + tráfico) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enriquecer el panel de análisis con 2 gráficas que aportan valor por propiedad (funcionan con una sola): **Ventas por día de la semana** (barras, Domingo→Sábado) y **Tráfico en el tiempo** (línea con órdenes + comensales). Solo frontend: usan la serie diaria que el endpoint ya devuelve.

**Architecture:** Un helper puro `salesByWeekday` en `src/lib/analytics.js` (agrupación por día de semana, seguro ante zona horaria); dos componentes cliente Recharts en `src/components/analytics/`; integración en `PanelClient.js` dentro de cada sección de moneda. Sin backend.

**Tech Stack:** Next.js 16 / React 19, Recharts, CSS Modules, i18n JSON, Vitest.

## Global Constraints

- Trabajar SOLO en `distinct_app_frontend`. No tocar el backend (el endpoint ya devuelve `daily: [{date, net_sales, order_count, guest_count}]`).
- Sistema de diseño (`CLAUDE.md`): gráficas tematizadas con los colores de los tokens (gold `#C9A96E`, smoke `#6E6E73`, platinum `#D8D8D8`), no la paleta por defecto de Recharts. Esquinas rectas, `prefers-reduced-motion`. Aplicar la guía `dataviz` para paleta/labels.
- **i18n:** títulos y etiquetas por i18n (`useT("analytics")`), claves nuevas en en.json Y es.json. Nunca "Moodle".
- **Día de semana en formato US: Domingo(0)→Sábado(6).** El parseo de la fecha debe ser **seguro ante zona horaria**: parsear `"YYYY-MM-DD"` por partes y construir `new Date(y, m-1, d)` (fecha local), NO `new Date("YYYY-MM-DD")` (que es UTC y puede desfasar el día).
- **Comando de tests:** `npx vitest run <ruta>` desde `distinct_app_frontend`.

---

### Task 1: Helper `salesByWeekday` (agrupación por día de semana)

**Files:**
- Modify: `src/lib/analytics.js` (añadir `salesByWeekday`)
- Test: `src/lib/__tests__/analytics.test.js` (añadir casos)

**Interfaces:**
- Produces: `salesByWeekday(daily) -> Array<{dow:number, net:number}>` de **7 elementos**, índice = día de semana (0=Domingo … 6=Sábado), `net` = suma de `net_sales` de ese día de semana. `daily` vacío/null → 7 ceros.

- [ ] **Step 1: Escribir los tests que fallan** — en `src/lib/__tests__/analytics.test.js`:

```js
import { salesByWeekday } from "../analytics";

describe("salesByWeekday", () => {
  it("agrupa por día de semana (Dom→Sáb) sumando net_sales", () => {
    // 2023-01-01 = Domingo, 2023-01-02 = Lunes, 2023-01-08 = Domingo
    const daily = [
      { date: "2023-01-01", net_sales: "100.00" },
      { date: "2023-01-08", net_sales: "50.00" },
      { date: "2023-01-02", net_sales: "30.00" },
    ];
    const r = salesByWeekday(daily);
    expect(r).toHaveLength(7);
    expect(r[0]).toEqual({ dow: 0, net: 150 }); // Domingo: 100+50
    expect(r[1]).toEqual({ dow: 1, net: 30 });  // Lunes: 30
    expect(r[2].net).toBe(0);                    // Martes..Sábado: 0
    expect(r[6].net).toBe(0);
  });

  it("es seguro ante zona horaria (no desfasa el día)", () => {
    // 2023-01-01 debe caer en Domingo (dow 0) sin importar la TZ local
    const r = salesByWeekday([{ date: "2023-01-01", net_sales: "10.00" }]);
    expect(r[0].net).toBe(10);
  });

  it("tolera vacío/null → 7 ceros", () => {
    const r = salesByWeekday(null);
    expect(r).toHaveLength(7);
    expect(r.every((b) => b.net === 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Correr para ver fallar** — `npx vitest run src/lib/__tests__/analytics.test.js` → FAIL (`salesByWeekday` no existe).

- [ ] **Step 3: Implementar** — añadir a `src/lib/analytics.js`:

```js
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
```

- [ ] **Step 4: Correr tests** — `npx vitest run src/lib/__tests__/analytics.test.js` → PASS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/analytics.js src/lib/__tests__/analytics.test.js
git commit -m "feat(analytics-fe): helper salesByWeekday (agrupacion por dia de semana, tz-safe)"
```

---

### Task 2: Componentes de gráfica (día de semana + tráfico)

**Files:**
- Create: `src/components/analytics/SalesByWeekdayChart.js`
- Create: `src/components/analytics/TrafficTrendChart.js`
- Test: `src/components/analytics/__tests__/charts2.test.js`

**Interfaces:**
- Produces:
  - `<SalesByWeekdayChart data={[{label, net}]} />` — barras.
  - `<TrafficTrendChart data={[{date, order_count, guest_count}]} ordersLabel guestsLabel />` — 2 líneas (órdenes + comensales).

- [ ] **Step 1: Escribir el test que falla** — `src/components/analytics/__tests__/charts2.test.js`:

```js
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import SalesByWeekdayChart from "../SalesByWeekdayChart";
import TrafficTrendChart from "../TrafficTrendChart";

afterEach(cleanup);

describe("charts2", () => {
  it("SalesByWeekdayChart monta con datos", () => {
    const { container } = render(
      <div style={{ width: 600, height: 300 }}>
        <SalesByWeekdayChart data={[{ label: "Sun", net: 100 }, { label: "Mon", net: 50 }]} />
      </div>
    );
    expect(container).toBeTruthy();
  });
  it("TrafficTrendChart monta con datos", () => {
    const { container } = render(
      <div style={{ width: 600, height: 300 }}>
        <TrafficTrendChart
          data={[{ date: "2026-05-06", order_count: 10, guest_count: 15 }]}
          ordersLabel="Orders" guestsLabel="Guests"
        />
      </div>
    );
    expect(container).toBeTruthy();
  });
  it("no rompen con datos vacíos", () => {
    render(<SalesByWeekdayChart data={[]} />);
    render(<TrafficTrendChart data={[]} ordersLabel="O" guestsLabel="G" />);
  });
});
```

- [ ] **Step 2: Correr para ver fallar** — `npx vitest run src/components/analytics/__tests__/charts2.test.js` → FAIL (componentes no existen).

- [ ] **Step 3: Crear `SalesByWeekdayChart.js`**

```jsx
"use client";

/**
 * SalesByWeekdayChart — ventas netas por día de la semana (barras).
 * Recibe data ya etiquetada [{label, net}] (7 elementos, Dom→Sáb) desde
 * PanelClient. Tematizada con los tokens (gold barras, smoke ejes).
 */

import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";

const GOLD = "#C9A96E"; // var(--color-gold)
const SMOKE = "#6E6E73"; // var(--color-smoke)

export default function SalesByWeekdayChart({ data }) {
  const rows = (data || []).map((d) => ({ label: d.label, net: Number(d.net) || 0 }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={rows} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
        <CartesianGrid stroke={SMOKE} strokeOpacity={0.2} vertical={false} />
        <XAxis dataKey="label" stroke={SMOKE} tick={{ fontSize: 12 }} />
        <YAxis stroke={SMOKE} tick={{ fontSize: 12 }} width={64} />
        <Tooltip />
        <Bar dataKey="net" fill={GOLD} />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 4: Crear `TrafficTrendChart.js`**

```jsx
"use client";

/**
 * TrafficTrendChart — órdenes y comensales por día (2 líneas).
 * net_sales no se usa aquí; usa order_count/guest_count de la serie diaria.
 * Etiquetas de leyenda (ordersLabel/guestsLabel) llegan traducidas desde
 * PanelClient. Tematizada con los tokens (gold órdenes, platinum comensales).
 */

import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

const GOLD = "#C9A96E";     // var(--color-gold)
const SMOKE = "#6E6E73";    // var(--color-smoke)
const PLATINUM = "#D8D8D8"; // var(--color-platinum)

export default function TrafficTrendChart({ data, ordersLabel, guestsLabel }) {
  const rows = (data || []).map((d) => ({
    date: d.date,
    orders: Number(d.order_count) || 0,
    guests: Number(d.guest_count) || 0,
  }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
        <CartesianGrid stroke={SMOKE} strokeOpacity={0.2} vertical={false} />
        <XAxis dataKey="date" stroke={SMOKE} tick={{ fontSize: 12 }} />
        <YAxis stroke={SMOKE} tick={{ fontSize: 12 }} width={64} />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="orders" name={ordersLabel} stroke={GOLD} strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="guests" name={guestsLabel} stroke={PLATINUM} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 5: Correr tests** — `npx vitest run src/components/analytics/__tests__/charts2.test.js` → PASS.

- [ ] **Step 6: Commit**
```bash
git add src/components/analytics/SalesByWeekdayChart.js src/components/analytics/TrafficTrendChart.js src/components/analytics/__tests__/charts2.test.js
git commit -m "feat(analytics-fe): graficas de dia de semana y trafico (Recharts)"
```

---

### Task 3: Integrar en el Panel + i18n

**Files:**
- Modify: `src/app/dashboard/analytics/PanelClient.js`
- Modify: `src/i18n/messages/en.json` y `es.json`
- Test: `src/app/dashboard/analytics/__tests__/PanelClient.test.js` (extender)

**Interfaces:**
- Consumes: `salesByWeekday` (Task 1), `SalesByWeekdayChart`/`TrafficTrendChart` (Task 2).

- [ ] **Step 1: Extender el test** — en `PanelClient.test.js`, añadir al caso que ya renderiza el reporte una aserción de que aparecen los nuevos títulos. Reutilizando el `REPORT` mockeado existente (una moneda con `daily`), añadir:

```js
  it("muestra las gráficas de día de semana y tráfico", async () => {
    isAuthenticated.mockReturnValue(true);
    getProperties.mockResolvedValue([{ id: 1, name: "P1", active: true, comp_id: 1, company_name: "C" }]);
    getSalesReport.mockResolvedValue(REPORT);
    render(<PanelClient />);
    await waitFor(() => expect(screen.getByText(/weekday|día de la semana|dia de la semana/i)).toBeInTheDocument());
    expect(screen.getByText(/traffic|tráfico|trafico/i)).toBeInTheDocument();
  });
```

(Si `REPORT` no está accesible en ese scope, reutilizar el mismo objeto mock del test existente de KPIs.)

- [ ] **Step 2: Correr para ver fallar** — `npx vitest run src/app/dashboard/analytics/__tests__/PanelClient.test.js` → FAIL (títulos no existen aún).

- [ ] **Step 3: Añadir claves i18n** (namespace `analytics`, en.json y es.json):
- `weekdayTitle`: "Sales by weekday" / "Ventas por día de la semana"
- `trafficTitle`: "Traffic (orders & guests)" / "Tráfico (órdenes y comensales)"
- Nombres cortos de día (formato US, Dom→Sáb): `wdSun,wdMon,wdTue,wdWed,wdThu,wdFri,wdSat`
  - en: "Sun","Mon","Tue","Wed","Thu","Fri","Sat"
  - es: "Dom","Lun","Mar","Mié","Jue","Vie","Sáb"
- (Se reutilizan `kpiOrders`/`kpiGuests` como etiquetas de leyenda del tráfico.)

- [ ] **Step 4: Integrar en `PanelClient.js`**
- Imports (arriba): `import { buildSalesCsv, formatDeltaPct, salesByWeekday } from "../../../lib/analytics";` (extender el import existente), y:
  ```jsx
  import SalesByWeekdayChart from "../../../components/analytics/SalesByWeekdayChart";
  import TrafficTrendChart from "../../../components/analytics/TrafficTrendChart";
  ```
- Constante a nivel de módulo (fuera del componente):
  ```js
  const WD_KEYS = ["wdSun", "wdMon", "wdTue", "wdWed", "wdThu", "wdFri", "wdSat"];
  ```
- Dentro del `.map((cur) => ...)`, **después** del bloque de la gráfica de tendencia existente (`trend-${cur.currency}`) y antes/junto a la comparativa por propiedad, añadir las dos nuevas (envueltas en el mismo `styles.chart` y con su título):
  ```jsx
  <h3 className={styles.cardTitle}>{t("weekdayTitle")}</h3>
  <div className={styles.chart}>
    <SalesByWeekdayChart
      data={salesByWeekday(cur.daily).map((b) => ({ label: t(WD_KEYS[b.dow]), net: b.net }))}
    />
  </div>

  <h3 className={styles.cardTitle}>{t("trafficTitle")}</h3>
  <div className={styles.chart}>
    <TrafficTrendChart data={cur.daily} ordersLabel={t("kpiOrders")} guestsLabel={t("kpiGuests")} />
  </div>
  ```
  (La comparativa por propiedad `by_property.length > 1` se mantiene igual. Estas dos NUEVAS siempre se muestran — aportan aun con una sola propiedad.)

- [ ] **Step 5: Correr test + suite** — `npx vitest run src/app/dashboard/analytics/__tests__/PanelClient.test.js` (PASS) y `npx vitest run` (sin regresiones).

- [ ] **Step 6: Commit**
```bash
git add src/app/dashboard/analytics/PanelClient.js src/i18n/messages/en.json src/i18n/messages/es.json src/app/dashboard/analytics/__tests__/PanelClient.test.js
git commit -m "feat(analytics-fe): integra graficas de dia de semana y trafico en el panel"
```

---

### Task 4: Verificación de la suite completa

- [ ] **Step 1:** `npx vitest run` → PASS (sin romper nada). Salida limpia (salvo warnings pre-existentes ya conocidos).
- [ ] **Step 2:** (Si algo falla) diagnosticar y corregir sin marcar completa con tests en rojo.

---

## Notas de despliegue
Ninguna. Solo frontend, usa datos que el endpoint ya devuelve. Al mergear + desplegar Vercel, las 2 gráficas aparecen en cada sección de moneda del panel (incluso con una sola propiedad).

## Fuera de alcance
Ticket promedio en el tiempo (3ª gráfica candidata, se puede sumar luego) · comparativos 3 meses / mes-vs-mes del doc (§5.1, feature aparte) · agrupación semanal/mensual.
