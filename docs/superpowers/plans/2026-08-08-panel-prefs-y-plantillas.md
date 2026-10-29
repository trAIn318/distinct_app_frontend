# Panel: personalización de gráficas + plantilla de Ventas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) Que el usuario **elija qué gráficas ver** en el panel (mostrar/ocultar cada una), recordado por usuario en su navegador (localStorage). (2) Un botón para **descargar la plantilla CSV de Ventas** (formato Toast) en la pantalla de carga.

**Architecture:** Helpers puros/aislados en `src/lib/` (prefs en localStorage + generador de plantilla); toggles + render condicional en `PanelClient.js`; botón de descarga en la pantalla de carga. Sin backend.

**Tech Stack:** Next.js 16 / React 19, CSS Modules, i18n JSON, Vitest.

## Global Constraints

- Trabajar SOLO en `distinct_app_frontend`. Sin backend.
- Sistema de diseño (`CLAUDE.md`): design tokens, esquinas rectas, `.btn-primary`/`ghostButton`, `prefers-reduced-motion`.
- i18n en en.json Y es.json. Nunca "Moodle".
- La preferencia de gráficas vive en **localStorage** (por navegador/usuario), con acceso protegido (`typeof window`, try/catch). Default: **todas visibles**.
- La plantilla de Ventas usa el **formato real de Toast** (header `yyyyMMdd,Net sales,Total orders,Total guests`).
- Comando de tests: `npx vitest run <ruta>` desde `distinct_app_frontend`.
- Base: esta rama sale de `feature/analytics-fase1-monthly` (contiene el panel con las 5 gráficas: trend, weekday, traffic, byProperty, monthly).

---

### Task 1: Helpers — prefs de gráficas (localStorage) + plantilla de Ventas

**Files:**
- Create: `src/lib/analyticsPrefs.js` (prefs de visibilidad de gráficas)
- Modify: `src/lib/analytics.js` (añadir `salesTemplateCsv`)
- Test: `src/lib/__tests__/analyticsPrefs.test.js` (crear) y añadir a `src/lib/__tests__/analytics.test.js`

**Interfaces:**
- Produces:
  - `CHART_IDS: string[]` = `["trend","weekday","traffic","byProperty","monthly"]`
  - `defaultChartPrefs() -> {trend:true, weekday:true, traffic:true, byProperty:true, monthly:true}`
  - `getChartPrefs() -> {[id]:boolean}` (lee localStorage; default si no hay/erróneo; SSR-safe)
  - `setChartPrefs(prefs) -> void` (guarda en localStorage; SSR-safe, try/catch)
  - `salesTemplateCsv() -> string` (plantilla CSV de ventas, formato Toast)

- [ ] **Step 1: Tests que fallan** — `src/lib/__tests__/analyticsPrefs.test.js`:

```js
import { describe, it, expect, beforeEach } from "vitest";
import { CHART_IDS, defaultChartPrefs, getChartPrefs, setChartPrefs } from "../analyticsPrefs";

beforeEach(() => { window.localStorage.clear(); });

describe("analyticsPrefs", () => {
  it("CHART_IDS lista los 5 tipos de gráfica", () => {
    expect(CHART_IDS).toEqual(["trend", "weekday", "traffic", "byProperty", "monthly"]);
  });
  it("defaultChartPrefs: todas visibles", () => {
    expect(defaultChartPrefs()).toEqual({
      trend: true, weekday: true, traffic: true, byProperty: true, monthly: true,
    });
  });
  it("getChartPrefs sin nada guardado → default", () => {
    expect(getChartPrefs()).toEqual(defaultChartPrefs());
  });
  it("setChartPrefs + getChartPrefs hace round-trip y mezcla con default", () => {
    setChartPrefs({ trend: false });
    const p = getChartPrefs();
    expect(p.trend).toBe(false);
    expect(p.weekday).toBe(true); // el resto queda en default
  });
  it("getChartPrefs tolera JSON corrupto → default", () => {
    window.localStorage.setItem("dx_analytics_charts", "no-json{");
    expect(getChartPrefs()).toEqual(defaultChartPrefs());
  });
});
```

Y en `src/lib/__tests__/analytics.test.js`:

```js
import { salesTemplateCsv } from "../analytics";

describe("salesTemplateCsv", () => {
  it("devuelve la plantilla con el header de Toast y una fila de ejemplo", () => {
    expect(salesTemplateCsv()).toBe(
      "yyyyMMdd,Net sales,Total orders,Total guests\n20260506,1345.50,24,39"
    );
  });
});
```

- [ ] **Step 2: Correr para ver fallar** — `npx vitest run src/lib/__tests__/analyticsPrefs.test.js src/lib/__tests__/analytics.test.js` → FAIL.

- [ ] **Step 3: Crear `src/lib/analyticsPrefs.js`**

```js
/**
 * src/lib/analyticsPrefs.js
 * Preferencia (por navegador) de qué gráficas del panel se muestran.
 * localStorage, con acceso protegido para SSR y navegadores sin storage.
 */

const KEY = "dx_analytics_charts";

export const CHART_IDS = ["trend", "weekday", "traffic", "byProperty", "monthly"];

export function defaultChartPrefs() {
  return CHART_IDS.reduce((acc, id) => ({ ...acc, [id]: true }), {});
}

export function getChartPrefs() {
  if (typeof window === "undefined") return defaultChartPrefs();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return defaultChartPrefs();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return defaultChartPrefs();
    return { ...defaultChartPrefs(), ...parsed };
  } catch {
    return defaultChartPrefs();
  }
}

export function setChartPrefs(prefs) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* almacenamiento no disponible: preferencia no persiste, sin romper */
  }
}
```

- [ ] **Step 4: Añadir `salesTemplateCsv` a `src/lib/analytics.js`**

```js
/** Plantilla CSV de Ventas (formato del reporte diario de Toast) para descargar:
 *  header real + una fila de ejemplo para que el cliente sepa el formato. */
export function salesTemplateCsv() {
  return [
    "yyyyMMdd,Net sales,Total orders,Total guests",
    "20260506,1345.50,24,39",
  ].join("\n");
}
```

- [ ] **Step 5: Correr tests** — PASS.

- [ ] **Step 6: Commit**
```bash
git add src/lib/analyticsPrefs.js src/lib/analytics.js src/lib/__tests__/analyticsPrefs.test.js src/lib/__tests__/analytics.test.js
git commit -m "feat(analytics-fe): prefs de graficas (localStorage) + plantilla CSV de ventas"
```

---

### Task 2: Toggles de gráficas en el Panel

**Files:**
- Modify: `src/app/dashboard/analytics/PanelClient.js`
- Modify: `src/app/dashboard/analytics/page.module.css` (estilo de los toggles)
- Modify: `src/i18n/messages/en.json` y `es.json`
- Test: `src/app/dashboard/analytics/__tests__/PanelClient.test.js` (extender)

**Interfaces:**
- Consumes: `getChartPrefs`, `setChartPrefs`, `CHART_IDS` (Task 1).

**Comportamiento:**
1. Estado `chartPrefs` inicializado en `defaultChartPrefs()` y **sincronizado desde localStorage en el efecto de montaje** (no en el render inicial, para evitar desajustes SSR/hidratación).
2. Una fila de **casillas** (checkboxes con `<label>`), una por gráfica, con su título i18n (`trendTitle`, `weekdayTitle`, `trafficTitle`, `byPropertyTitle`, `monthlyTitle`) y un encabezado `t("showCharts")`. Al cambiar una: actualiza el estado y llama `setChartPrefs`.
3. Cada bloque de gráfica se renderiza solo si su pref está activa. La comparativa por propiedad mantiene además su condición `by_property.length > 1` (se muestra si **pref activa Y** hay 2+).

**Claves i18n a añadir (namespace `analytics`, en/es):** `showCharts` ("Charts" / "Gráficas") — encabezado del control. (Los títulos de cada gráfica ya existen.)

- [ ] **Step 1: Extender el test** — en `PanelClient.test.js`, con el mock `REPORT` que ya renderiza el panel, añadir:

```js
  it("permite ocultar una gráfica con su toggle", async () => {
    isAuthenticated.mockReturnValue(true);
    getProperties.mockResolvedValue([{ id: 1, name: "P1", active: true, comp_id: 1, company_name: "C" }]);
    getSalesReport.mockResolvedValue(REPORT);
    render(<PanelClient />);
    // la gráfica de tendencia aparece
    await waitFor(() => expect(screen.getByText(/^Trend$|Tendencia/i)).toBeInTheDocument());
    // apagar el toggle de "trend" (checkbox con nombre accesible del título de tendencia)
    const trendToggle = screen.getByRole("checkbox", { name: /^Trend$|Tendencia/i });
    fireEvent.click(trendToggle);
    // el encabezado de la gráfica de tendencia desaparece (ya no como heading)
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: /^Trend$|Tendencia/i })).not.toBeInTheDocument()
    );
  });
```

(Ajustar los matchers a los textos reales; el punto es: apagar el toggle oculta el bloque. Si hace falta, usar `data-testid` de los bloques ya existentes para asertar. No debilitar la prueba.)

- [ ] **Step 2: Correr para ver fallar** → FAIL (no hay toggles todavía).

- [ ] **Step 3: Añadir clave i18n** `showCharts` (en/es).

- [ ] **Step 4: Integrar en `PanelClient.js`**
- Imports: `import { getChartPrefs, setChartPrefs, defaultChartPrefs, CHART_IDS } from "../../../lib/analyticsPrefs";`
- Estado: `const [chartPrefs, setChartPrefsState] = useState(defaultChartPrefs());`
- En el efecto de montaje (donde ya está `if (!ready) return; ... load();`), añadir: `setChartPrefsState(getChartPrefs());`
- Mapa título↔id para las etiquetas:
  ```js
  const CHART_LABEL_KEYS = { trend: "trendTitle", weekday: "weekdayTitle", traffic: "trafficTitle", byProperty: "byPropertyTitle", monthly: "monthlyTitle" };
  ```
  (a nivel de módulo)
- Handler:
  ```js
  function toggleChart(id) {
    setChartPrefsState((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      setChartPrefs(next);
      return next;
    });
  }
  ```
- Control (una vez, arriba de las secciones de moneda, dentro del panel):
  ```jsx
  <fieldset className={styles.chartToggles}>
    <legend className={styles.fieldLabel}>{t("showCharts")}</legend>
    {CHART_IDS.map((id) => (
      <label key={id} className={styles.toggleItem}>
        <input type="checkbox" checked={chartPrefs[id]} onChange={() => toggleChart(id)} />
        <span>{t(CHART_LABEL_KEYS[id])}</span>
      </label>
    ))}
  </fieldset>
  ```
- Envolver cada bloque de gráfica con su pref:
  - Trend: `{chartPrefs.trend && (<>...trend...</>)}`
  - Weekday: `{chartPrefs.weekday && (...)}`
  - Traffic: `{chartPrefs.traffic && (...)}`
  - Monthly: `{chartPrefs.monthly && (...)}`
  - By-property: `{chartPrefs.byProperty && cur.by_property.length > 1 && (...)}`
  (KPIs y tabla de detalle NO se tocan — siempre visibles.)

- [ ] **Step 5: Crear estilos** en `page.module.css`: `.chartToggles` (fila flex, wrap, sin borde de fieldset por defecto → `border:0; padding:0; margin:0`), `.toggleItem` (flex, gap, cursor pointer, tipografía de label con tokens). Sin valores mágicos: usar tokens de espaciado.

- [ ] **Step 6: Correr test + suite** — focused (PASS) y `npx vitest run` (sin regresiones).

- [ ] **Step 7: Commit**
```bash
git add src/app/dashboard/analytics/PanelClient.js src/app/dashboard/analytics/page.module.css src/i18n/messages/en.json src/i18n/messages/es.json src/app/dashboard/analytics/__tests__/PanelClient.test.js
git commit -m "feat(analytics-fe): toggles para mostrar/ocultar cada grafica (persistido en localStorage)"
```

---

### Task 3: Botón "Descargar plantilla de Ventas" en la pantalla de carga

**Files:**
- Modify: `src/app/dashboard/analytics/upload/AnalyticsUploadClient.js`
- Modify: `src/i18n/messages/en.json` y `es.json`
- Test: `src/app/dashboard/analytics/upload/__tests__/AnalyticsUploadClient.test.js` (extender)

**Interfaces:**
- Consumes: `salesTemplateCsv` (Task 1).

**Comportamiento:** un botón "Descargar plantilla" que genera un CSV (Blob) con `salesTemplateCsv()` y lo descarga como `plantilla_ventas_toast.csv`, con un texto de ayuda corto. Ubicado cerca del input de archivo.

**Claves i18n (namespace `analytics`, en/es):** `downloadTemplate` ("Download template" / "Descargar plantilla"), `templateHint` ("Not sure of the format? Download the sales template." / "¿No sabes el formato? Descarga la plantilla de ventas.").

- [ ] **Step 1: Extender el test** — en `AnalyticsUploadClient.test.js`:

```js
  it("muestra el botón de descargar plantilla", async () => {
    isAuthenticated.mockReturnValue(true);
    getProperties.mockResolvedValue([]);
    render(<AnalyticsUploadClient />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /template|plantilla/i })).toBeInTheDocument()
    );
  });
```

- [ ] **Step 2: Correr para ver fallar** → FAIL.

- [ ] **Step 3: Añadir claves i18n** `downloadTemplate`, `templateHint` (en/es).

- [ ] **Step 4: Integrar en `AnalyticsUploadClient.js`**
- Import: `import { salesTemplateCsv } from "../../../../lib/analytics";` (ojo: 4 niveles, esta pantalla está en `upload/`; extender el import existente de `lib/analytics` si ya lo hay, o agregarlo).
- Handler (mismo patrón que la descarga CSV del panel):
  ```js
  function downloadTemplate() {
    const csv = salesTemplateCsv();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla_ventas_toast.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  ```
- UI: cerca del campo de archivo, un botón `ghostButton` con `t("downloadTemplate")` y un `<span className={styles.muted}>{t("templateHint")}</span>`.

- [ ] **Step 5: Correr test + suite** — focused (PASS) y `npx vitest run` (sin regresiones).

- [ ] **Step 6: Commit**
```bash
git add src/app/dashboard/analytics/upload/AnalyticsUploadClient.js src/i18n/messages/en.json src/i18n/messages/es.json src/app/dashboard/analytics/upload/__tests__/AnalyticsUploadClient.test.js
git commit -m "feat(analytics-fe): descarga de plantilla CSV de ventas en la pantalla de carga"
```

---

### Task 4: Verificación de la suite completa

- [ ] **Step 1:** `npx vitest run` → PASS. Salida limpia.
- [ ] **Step 2:** (Si algo falla) diagnosticar y corregir sin marcar completa con tests en rojo.

---

## Notas de despliegue
Ninguna. Solo frontend. Al mergear + desplegar Vercel: en el panel aparecen los toggles de gráficas (recordados por navegador) y en la pantalla de carga el botón de descargar la plantilla de Ventas.

## Fuera de alcance
Persistir la preferencia de gráficas en el servidor (por ahora localStorage) · plantillas de otras fases (Product Mix/Empleados/Laboral) — esperan un export real de Toast · reordenar gráficas por drag-and-drop.
