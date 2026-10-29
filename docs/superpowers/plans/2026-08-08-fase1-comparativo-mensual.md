# Fase 1.2 — Comparativo mensual de ventas (Frontend) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir al panel un **comparativo mensual** de ventas netas (barras por mes) + un indicador **mes vs mes** (último mes vs. anterior, ▲/▼ %). Cubre el §5.1 del doc (comparativo de meses / mes contra mes). Solo frontend: agrupa por mes la serie diaria que el endpoint ya devuelve; respeta el filtro de fechas del panel.

**Architecture:** Helper puro `monthlySales` + `monthOverMonthPct` en `src/lib/analytics.js`; componente Recharts `SalesByMonthChart` en `src/components/analytics/`; integración en `PanelClient.js` por sección de moneda. Sin backend.

**Tech Stack:** Next.js 16 / React 19, Recharts, i18n JSON, Vitest.

## Global Constraints

- Trabajar SOLO en `distinct_app_frontend`. Sin backend (usa `cur.daily` del reporte).
- Sistema de diseño (`CLAUDE.md`): colores por tokens (gold `#C9A96E`, smoke `#6E6E73`), esquinas rectas, `prefers-reduced-motion`.
- i18n en en.json Y es.json. Nunca "Moodle".
- **Agrupación por mes segura ante zona horaria:** usar el prefijo del texto de la fecha `String(date).slice(0,7)` ("YYYY-MM"), NO `new Date(...)`.
- Comando de tests: `npx vitest run <ruta>` desde `distinct_app_frontend`.

---

### Task 1: Helpers `monthlySales` + `monthOverMonthPct`

**Files:**
- Modify: `src/lib/analytics.js`
- Test: `src/lib/__tests__/analytics.test.js` (añadir casos)

**Interfaces:**
- Produces:
  - `monthlySales(daily) -> Array<{month:"YYYY-MM", net:number}>` ordenado cronológicamente; suma `net_sales` por mes; vacío/null → `[]`.
  - `monthOverMonthPct(monthly) -> number|null` — variación % (1 decimal) del último mes vs. el anterior; `null` si hay <2 meses o el anterior es 0.

- [ ] **Step 1: Tests que fallan** — en `src/lib/__tests__/analytics.test.js`:

```js
import { monthlySales, monthOverMonthPct } from "../analytics";

describe("monthlySales", () => {
  it("agrupa por mes (YYYY-MM) sumando net_sales, ordenado", () => {
    const daily = [
      { date: "2026-04-30", net_sales: "100.00" },
      { date: "2026-05-01", net_sales: "200.00" },
      { date: "2026-05-15", net_sales: "50.00" },
      { date: "2026-03-10", net_sales: "10.00" },
    ];
    expect(monthlySales(daily)).toEqual([
      { month: "2026-03", net: 10 },
      { month: "2026-04", net: 100 },
      { month: "2026-05", net: 250 },
    ]);
  });
  it("vacío/null → []", () => {
    expect(monthlySales(null)).toEqual([]);
    expect(monthlySales([])).toEqual([]);
  });
});

describe("monthOverMonthPct", () => {
  it("calcula el % del último mes vs el anterior (1 decimal)", () => {
    const m = [{ month: "2026-04", net: 100 }, { month: "2026-05", net: 150 }];
    expect(monthOverMonthPct(m)).toBe(50);       // +50%
  });
  it("null si hay menos de 2 meses o el anterior es 0", () => {
    expect(monthOverMonthPct([{ month: "2026-05", net: 100 }])).toBeNull();
    expect(monthOverMonthPct([])).toBeNull();
    expect(monthOverMonthPct(null)).toBeNull();
    expect(monthOverMonthPct([{ month: "2026-04", net: 0 }, { month: "2026-05", net: 100 }])).toBeNull();
  });
});
```

- [ ] **Step 2: Correr para ver fallar** — `npx vitest run src/lib/__tests__/analytics.test.js` → FAIL.

- [ ] **Step 3: Implementar** — añadir a `src/lib/analytics.js`:

```js
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
```

- [ ] **Step 4: Correr tests** — PASS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/analytics.js src/lib/__tests__/analytics.test.js
git commit -m "feat(analytics-fe): helpers monthlySales + monthOverMonthPct"
```

---

### Task 2: Componente `SalesByMonthChart`

**Files:**
- Create: `src/components/analytics/SalesByMonthChart.js`
- Test: `src/components/analytics/__tests__/charts3.test.js`

**Interfaces:**
- Produces: `<SalesByMonthChart data={[{month, net}]} />` — barras.

- [ ] **Step 1: Test que falla** — `src/components/analytics/__tests__/charts3.test.js`:

```js
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import SalesByMonthChart from "../SalesByMonthChart";

afterEach(cleanup);

describe("SalesByMonthChart", () => {
  it("monta con datos", () => {
    const { container } = render(
      <div style={{ width: 600, height: 300 }}>
        <SalesByMonthChart data={[{ month: "2026-04", net: 100 }, { month: "2026-05", net: 250 }]} />
      </div>
    );
    expect(container).toBeTruthy();
  });
  it("no rompe con datos vacíos", () => {
    render(<SalesByMonthChart data={[]} />);
  });
});
```

- [ ] **Step 2: Correr para ver fallar** → FAIL (no existe el componente).

- [ ] **Step 3: Crear `SalesByMonthChart.js`** (mismo estilo que `SalesByPropertyChart.js`):

```jsx
"use client";

/**
 * SalesByMonthChart — ventas netas por mes (barras). data=[{month,net}].
 * Tematizada con los tokens (gold barras, smoke ejes).
 */

import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";

const GOLD = "#C9A96E"; // var(--color-gold)
const SMOKE = "#6E6E73"; // var(--color-smoke)

export default function SalesByMonthChart({ data }) {
  const rows = (data || []).map((d) => ({ month: d.month, net: Number(d.net) || 0 }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={rows} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
        <CartesianGrid stroke={SMOKE} strokeOpacity={0.2} vertical={false} />
        <XAxis dataKey="month" stroke={SMOKE} tick={{ fontSize: 12 }} />
        <YAxis stroke={SMOKE} tick={{ fontSize: 12 }} width={64} />
        <Tooltip />
        <Bar dataKey="net" fill={GOLD} />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 4: Correr tests** — PASS.

- [ ] **Step 5: Commit**
```bash
git add src/components/analytics/SalesByMonthChart.js src/components/analytics/__tests__/charts3.test.js
git commit -m "feat(analytics-fe): grafica de ventas por mes (Recharts)"
```

---

### Task 3: Integrar en el Panel + i18n

**Files:**
- Modify: `src/app/dashboard/analytics/PanelClient.js`
- Modify: `src/i18n/messages/en.json` y `es.json`
- Test: `src/app/dashboard/analytics/__tests__/PanelClient.test.js` (extender)

**Interfaces:**
- Consumes: `monthlySales`, `monthOverMonthPct` (Task 1), `SalesByMonthChart` (Task 2), `formatDeltaPct` (ya existe).

- [ ] **Step 1: Extender el test** — añadir a `PanelClient.test.js` (reutilizando el mock `REPORT` con su `daily`):

```js
  it("muestra el comparativo mensual", async () => {
    isAuthenticated.mockReturnValue(true);
    getProperties.mockResolvedValue([{ id: 1, name: "P1", active: true, comp_id: 1, company_name: "C" }]);
    getSalesReport.mockResolvedValue(REPORT);
    render(<PanelClient />);
    await waitFor(() => expect(screen.getByText(/monthly|mensual/i)).toBeInTheDocument());
  });
```

- [ ] **Step 2: Correr para ver fallar** → FAIL (título no existe).

- [ ] **Step 3: Añadir claves i18n** (namespace `analytics`, en.json y es.json):
- `monthlyTitle`: "Monthly comparison" / "Comparativo mensual"
- `vsPrevMonth`: "vs. previous month" / "vs. mes anterior"

- [ ] **Step 4: Integrar en `PanelClient.js`**
- Imports: extender el de `lib/analytics` con `monthlySales, monthOverMonthPct`; y `import SalesByMonthChart from "../../../components/analytics/SalesByMonthChart";`
- Dentro del `.map((cur) => ...)`, junto a las otras gráficas (después de la tendencia, por ejemplo), añadir:
  ```jsx
  <h3 className={styles.cardTitle}>{t("monthlyTitle")}</h3>
  {(() => {
    const monthly = monthlySales(cur.daily);
    const mom = monthOverMonthPct(monthly);
    return (
      <>
        {formatDeltaPct(mom) && (
          <span className={mom > 0 ? styles.deltaUp : mom < 0 ? styles.deltaDown : styles.deltaFlat}>
            {formatDeltaPct(mom)} <span className={styles.muted}>{t("vsPrevMonth")}</span>
          </span>
        )}
        <div className={styles.chart}>
          <SalesByMonthChart data={monthly} />
        </div>
      </>
    );
  })()}
  ```
  (Se muestra siempre; con un solo mes, la barra sale y el "mes vs mes" se oculta porque `mom` es `null`.)

- [ ] **Step 5: Correr test + suite** — focused (PASS) y `npx vitest run` (sin regresiones). Si el test necesita ajuste para casar con el markup final, corregir el TEST (sin debilitarlo) y anotarlo.

- [ ] **Step 6: Commit**
```bash
git add src/app/dashboard/analytics/PanelClient.js src/i18n/messages/en.json src/i18n/messages/es.json src/app/dashboard/analytics/__tests__/PanelClient.test.js
git commit -m "feat(analytics-fe): comparativo mensual (barras por mes + mes vs mes) en el panel"
```

---

### Task 4: Verificación de la suite completa

- [ ] **Step 1:** `npx vitest run` → PASS (sin romper nada). Salida limpia.
- [ ] **Step 2:** (Si algo falla) diagnosticar y corregir sin marcar completa con tests en rojo.

---

## Notas de despliegue
Ninguna. Solo frontend, usa datos que el endpoint ya devuelve. Al mergear + desplegar Vercel, el comparativo mensual aparece en cada sección de moneda del panel.

## Fuera de alcance
Comparativo específico "vs. mismo mes del año anterior" (YoY) · ventana fija propia de N meses (se usa el filtro del panel) · orders/guests mensuales (solo net sales en esta entrega).
