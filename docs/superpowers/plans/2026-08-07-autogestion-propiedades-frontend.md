# Autogestión de propiedades (Frontend) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar UI a la autogestión de propiedades + carga de ventas: dos pantallas (Cargar ventas / Mis propiedades) para que Admin y Admin Company suban su export de Toast (ZIP o CSV) y gestionen sus propiedades, contra los endpoints ya en producción.

**Architecture:** Next.js App Router (JS, CSS Modules). Cada pantalla = `page.js` (server component con `getT` + metadata) que renderiza un client component (`"use client"`) con guard de auth, `useT`, estado con hooks y llamadas a `lib/api`. La lógica pura y las funciones de red siguen el patrón del módulo `eval` (pura en `lib/`, red en `lib/api.js`). El menú es data-driven: se agrega el mapeo de ruta en el frontend y las filas de menú/rol se siembran en la BD (paso de deploy del controlador).

**Tech Stack:** Next.js (App Router), React, CSS Modules, i18n JSON (`useT`/`getT`), Vitest + @testing-library/react. Backend ya desplegado (endpoints de propiedades + carga).

## Global Constraints

- Trabajar SOLO en `distinct_app_frontend`. No tocar el backend (sus endpoints ya están vivos) ni `distinct_app`.
- **Sistema de diseño (su `CLAUDE.md`):** usar SIEMPRE los design tokens (colores obsidiana/marfil/oro, tipografías, espaciado φ), esquinas rectas (`border-radius: 0`), botones `.btn-primary` (clase global) en mayúsculas, `@media (prefers-reduced-motion)` en animaciones. Nada de valores hardcodeados de color/espaciado. Seguir el patrón del módulo `eval` (`src/app/dashboard/eval/`).
- **i18n:** todo texto visible pasa por i18n (`useT("analytics")` en cliente, `getT("analytics")` en server). Agregar claves en `src/i18n/messages/en.json` Y `src/i18n/messages/es.json`. Nunca renderizar literalmente la palabra "Moodle".
- **Auth:** páginas privadas. Guard como en `EvalClient`: `if (!isAuthenticated()) router.replace("/login?next=<ruta>")`. La autorización real la hace el backend (403/422) — el frontend no hace hard-gating por rol (el usuario en sesión no trae `comp_id` ni `rol_id` fiables), solo muestra errores del backend.
- **Formatos de carga:** el input de archivo acepta **`.zip` y `.csv`** (`accept=".zip,.csv"`) y el copy lo comunica ("Sube el export en ZIP o el archivo Sales by day.csv"). El backend valida por firma de columnas en ambos casos.
- **Contrato del backend (exacto):**
  - `GET /api/analytics/properties/` → `{"properties":[{id,name,currency,active,comp_id,company_name}]}` (todas las del alcance, activas e inactivas).
  - `POST /api/analytics/properties/` body `{name, currency, comp_id?}` → `201 {"property":{...}}` | `{"errors":[msg]}` con status 409/403/400.
  - `PATCH /api/analytics/properties/<id>/` body `{name?,currency?,active?}` → `200 {"property":{...}}` | `{"errors":[msg]}` 409/403/400/404.
  - `POST /api/analytics/uploads/preview/` multipart `{property_id, file}` → `200 {"summary":{row_count,period_start,period_end,net_sales_total,property_name,batch_id}}` | `422 {"errors":[...]}` | `400/403 {"detail":...}`.
  - `POST /api/analytics/uploads/` multipart `{property_id, file}` → `201 {"summary":{...}}` (mismos errores).
- **Comando de tests (PowerShell, venv de node no aplica — es Node):** `npm run test -- <ruta>` o `npx vitest run <ruta>`. Ejecutar desde `distinct_app_frontend`. El proyecto usa Vitest (`vitest.config.mjs`, `vitest.setup.js`).
- Monedas válidas (para el `<select>` de moneda): `USD`, `COP` (coincide con el backend).

---

### Task 1: Capa de datos — `lib/api.js` (red) + `lib/analytics.js` (lógica pura) + tests

**Files:**
- Modify: `src/lib/api.js` (añadir `authUpload` + funciones de analytics; ampliar el mensaje de error de `authFetch` para incluir `errors[]`)
- Create: `src/lib/analytics.js` (helpers puros)
- Test: `src/lib/__tests__/analytics.test.js` (crear)

**Interfaces:**
- Consumes: `API_URL` (de `./config`), `getAccessToken` (de `./session`), `authFetch` (privada en `api.js`).
- Produces (para Tasks 2-3):
  - `authUpload(path, formData) -> Promise<object>` (multipart POST autenticado)
  - `getProperties() -> Promise<Array>` ; `createProperty({name,currency,comp_id?}) -> Promise<{property}>` ; `updateProperty(id, changes) -> Promise<{property}>` ; `previewUpload(propertyId, file) -> Promise<{summary}>` ; `commitUpload(propertyId, file) -> Promise<{summary}>`
  - `deriveCompanies(properties) -> Array<{comp_id,company_name}>` ; `activeProperties(properties) -> Array` ; `isAcceptedFile(filename) -> boolean` (de `lib/analytics.js`)

- [ ] **Step 1: Escribir los tests que fallan** — `src/lib/__tests__/analytics.test.js`:

```js
import { describe, it, expect } from "vitest";
import { deriveCompanies, activeProperties, isAcceptedFile } from "../analytics";

describe("deriveCompanies", () => {
  it("devuelve compañías únicas por comp_id", () => {
    const props = [
      { comp_id: 1, company_name: "Distinct" },
      { comp_id: 1, company_name: "Distinct" },
      { comp_id: 2, company_name: "Mucura" },
    ];
    expect(deriveCompanies(props)).toEqual([
      { comp_id: 1, company_name: "Distinct" },
      { comp_id: 2, company_name: "Mucura" },
    ]);
  });
  it("tolera entradas nulas/incompletas", () => {
    expect(deriveCompanies(null)).toEqual([]);
    expect(deriveCompanies([{ company_name: "x" }])).toEqual([]);
  });
});

describe("activeProperties", () => {
  it("filtra solo activas", () => {
    const props = [{ id: 1, active: true }, { id: 2, active: false }];
    expect(activeProperties(props)).toEqual([{ id: 1, active: true }]);
  });
  it("tolera null", () => {
    expect(activeProperties(null)).toEqual([]);
  });
});

describe("isAcceptedFile", () => {
  it("acepta .zip y .csv (case-insensitive)", () => {
    expect(isAcceptedFile("export.zip")).toBe(true);
    expect(isAcceptedFile("Sales by day.CSV")).toBe(true);
  });
  it("rechaza otros", () => {
    expect(isAcceptedFile("foo.pdf")).toBe(false);
    expect(isAcceptedFile("")).toBe(false);
    expect(isAcceptedFile(null)).toBe(false);
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run (desde `distinct_app_frontend`): `npx vitest run src/lib/__tests__/analytics.test.js`
Expected: FAIL — `Failed to resolve import "../analytics"`.

- [ ] **Step 3: Crear `src/lib/analytics.js`**

```js
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
```

- [ ] **Step 4: Ampliar `src/lib/api.js`**

4a. En la función privada `authFetch`, cambiar SOLO la línea del throw de error para incluir `errors[]` (los endpoints de propiedades devuelven `{errors:[...]}`, no `detail`). De:
```js
  if (!res.ok) throw new Error(data.detail || "Something went wrong. Please try again.");
```
a:
```js
  if (!res.ok) {
    throw new Error(
      data.detail ||
        (Array.isArray(data.errors) && data.errors[0]) ||
        "Something went wrong. Please try again."
    );
  }
```

4b. Añadir al final del archivo (después del bloque de Evaluaciones):
```js
// ── Analytics: propiedades + carga de ventas (autenticado) ──────────────────

/** POST multipart autenticado. No fija Content-Type: el navegador pone el
 *  boundary de multipart/form-data automáticamente. */
export async function authUpload(path, formData) {
  const token = getAccessToken();
  if (!token) throw new Error("You must be signed in.");
  const res = await fetch(`${API_URL}/api${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      data.detail ||
        (Array.isArray(data.errors) && data.errors[0]) ||
        "Upload failed. Please try again."
    );
  }
  return data;
}

/** GET /api/analytics/properties/ — propiedades del alcance. [] si falla suave. */
export async function getProperties() {
  const data = await authFetch("/analytics/properties/");
  return data?.properties ?? [];
}

/** POST /api/analytics/properties/ — crea una propiedad. */
export async function createProperty({ name, currency, comp_id }) {
  return authFetch("/analytics/properties/", {
    method: "POST",
    body: { name, currency, ...(comp_id != null ? { comp_id } : {}) },
  });
}

/** PATCH /api/analytics/properties/<id>/ — renombra / cambia moneda / activa. */
export async function updateProperty(id, changes) {
  return authFetch(`/analytics/properties/${id}/`, { method: "PATCH", body: changes });
}

/** POST /api/analytics/uploads/preview/ — dry-run (no escribe). */
export async function previewUpload(propertyId, file) {
  const fd = new FormData();
  fd.append("property_id", propertyId);
  fd.append("file", file);
  return authUpload("/analytics/uploads/preview/", fd);
}

/** POST /api/analytics/uploads/ — confirma y guarda. */
export async function commitUpload(propertyId, file) {
  const fd = new FormData();
  fd.append("property_id", propertyId);
  fd.append("file", file);
  return authUpload("/analytics/uploads/", fd);
}
```

- [ ] **Step 5: Correr los tests para verificar que pasan**

Run: `npx vitest run src/lib/__tests__/analytics.test.js`
Expected: PASS (todos).

- [ ] **Step 6: Commit**

```bash
git add src/lib/analytics.js src/lib/api.js src/lib/__tests__/analytics.test.js
git commit -m "feat(analytics-fe): capa de datos (api de propiedades/carga + helpers puros)"
```

---

### Task 2: Pantalla "Cargar ventas" (`app/dashboard/analytics/`)

**Files:**
- Create: `src/app/dashboard/analytics/page.js` (server component)
- Create: `src/app/dashboard/analytics/AnalyticsUploadClient.js` (client)
- Create: `src/app/dashboard/analytics/page.module.css`
- Modify: `src/i18n/messages/en.json` y `src/i18n/messages/es.json` (namespace `analytics`)
- Test: `src/app/dashboard/analytics/__tests__/AnalyticsUploadClient.test.js`

**Interfaces:**
- Consumes de Task 1: `getProperties`, `createProperty`, `previewUpload`, `commitUpload`, `deriveCompanies`, `activeProperties`, `isAcceptedFile`; `isAuthenticated` (de `lib/session`), `useT` (de `i18n/client`).
- Produces: ruta `/dashboard/analytics` funcional (referenciada por Task 4).

**Comportamiento (contrato — el test de Step 6 lo fija):**
1. Guard: sin sesión → `router.replace("/login?next=/dashboard/analytics")` y no renderiza.
2. Al montar (con sesión) carga `getProperties()`. El **selector de propiedad** lista `activeProperties(...)` (dropdown) más una opción "➕ Agregar nueva".
3. "➕ Agregar nueva" abre un mini-form inline: campo **nombre** (requerido), **moneda** (`<select>` USD/COP, default USD) y —solo si `deriveCompanies(properties).length > 1`— un `<select>` **compañía** (requerido) construido de `deriveCompanies`. Al guardar: `createProperty(...)`; si ok, recarga propiedades, selecciona la nueva y cierra el mini-form; si error, muestra `err.message` inline.
4. **Archivo:** `<input type="file" accept=".zip,.csv">`. El copy indica "ZIP o Sales by day.csv". Si el archivo elegido no pasa `isAcceptedFile`, muestra aviso y deshabilita las acciones.
5. **Vista previa:** botón (deshabilitado sin propiedad o sin archivo válido) → `previewUpload(propertyId, file)` → muestra el `summary` (filas, periodo `period_start`–`period_end`, `net_sales_total`, `property_name`). Errores (`err.message`) inline.
6. **Confirmar:** tras una preview ok, botón `.btn-primary` → `commitUpload(...)` → mensaje de éxito con el `summary` (batch_id). Errores inline.
7. Enlace a **"Mis propiedades"** (`/dashboard/analytics/properties`).

**Claves i18n a añadir bajo `"analytics"` (mismas en en.json y es.json, traducidas):** `uploadTitle, selectProperty, addNew, name, currency, company, save, cancel, chooseFile, fileHint, fileTypeError, preview, previewLoading, confirm, confirmLoading, summaryRows, summaryPeriod, summaryNet, summaryProperty, uploadSuccess, managePropertiesLink, loading, unavailable, needProperty, needFile`.

- [ ] **Step 1: Escribir el test que falla** — `src/app/dashboard/analytics/__tests__/AnalyticsUploadClient.test.js`:

```js
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

const isAuthenticated = vi.fn();
vi.mock("../../../../lib/session", () => ({
  isAuthenticated: (...a) => isAuthenticated(...a),
}));

const getProperties = vi.fn();
const createProperty = vi.fn();
const previewUpload = vi.fn();
const commitUpload = vi.fn();
vi.mock("../../../../lib/api", () => ({
  getProperties: (...a) => getProperties(...a),
  createProperty: (...a) => createProperty(...a),
  previewUpload: (...a) => previewUpload(...a),
  commitUpload: (...a) => commitUpload(...a),
}));

import AnalyticsUploadClient from "../AnalyticsUploadClient";

afterEach(cleanup);
beforeEach(() => {
  replace.mockClear();
  isAuthenticated.mockReset();
  getProperties.mockReset();
  createProperty.mockReset();
  previewUpload.mockReset();
  commitUpload.mockReset();
});

describe("AnalyticsUploadClient — auth guard", () => {
  it("redirige a login sin sesión", () => {
    isAuthenticated.mockReturnValue(false);
    render(<AnalyticsUploadClient />);
    expect(replace).toHaveBeenCalledWith("/login?next=/dashboard/analytics");
  });
});

describe("AnalyticsUploadClient — carga", () => {
  beforeEach(() => {
    isAuthenticated.mockReturnValue(true);
    getProperties.mockResolvedValue([
      { id: 10, name: "Rooftop", currency: "USD", active: true, comp_id: 1, company_name: "Distinct" },
    ]);
  });

  it("lista las propiedades activas en el selector", async () => {
    render(<AnalyticsUploadClient />);
    await waitFor(() => expect(screen.getByText("Rooftop")).toBeInTheDocument());
  });

  it("preview -> confirm hace commit y muestra éxito", async () => {
    previewUpload.mockResolvedValue({
      summary: { row_count: 5, period_start: "2026-05-06", period_end: "2026-05-10",
                 net_sales_total: "8716.23", property_name: "Rooftop", batch_id: 1 },
    });
    commitUpload.mockResolvedValue({
      summary: { row_count: 5, period_start: "2026-05-06", period_end: "2026-05-10",
                 net_sales_total: "8716.23", property_name: "Rooftop", batch_id: 2 },
    });
    render(<AnalyticsUploadClient />);
    await waitFor(() => expect(screen.getByText("Rooftop")).toBeInTheDocument());

    // elegir propiedad
    fireEvent.change(screen.getByLabelText(/selectProperty|Propiedad|Property/i), { target: { value: "10" } });
    // elegir archivo válido
    const file = new File(["yyyyMMdd,Net sales\n20260506,1"], "Sales by day.csv", { type: "text/csv" });
    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [file] } });

    // preview
    fireEvent.click(screen.getByRole("button", { name: /preview|vista previa/i }));
    await waitFor(() => expect(previewUpload).toHaveBeenCalledWith("10", file));

    // confirm (el botón solo aparece cuando el summary de la preview ya está en estado)
    const confirmBtn = await screen.findByRole("button", { name: /confirm|confirmar/i });
    fireEvent.click(confirmBtn);
    await waitFor(() => expect(commitUpload).toHaveBeenCalledWith("10", file));
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run src/app/dashboard/analytics/__tests__/AnalyticsUploadClient.test.js`
Expected: FAIL — no existe `../AnalyticsUploadClient`.

- [ ] **Step 3: Crear `page.js`** (server component, patrón de `eval/page.js`):

```jsx
import AnalyticsUploadClient from "./AnalyticsUploadClient";
import { getT } from "../../../i18n/server";
import styles from "./page.module.css";

export const metadata = {
  title: "Sales upload | Distinct Hospitality Solutions",
  description: "Upload your Toast sales export and manage your properties.",
};

export default async function AnalyticsUploadPage() {
  const t = await getT("analytics");
  return (
    <div className={styles.page}>
      <div className={`container ${styles.wrapper}`}>
        <h1 className={styles.h1}>{t("uploadTitle")}</h1>
        <AnalyticsUploadClient />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Crear `AnalyticsUploadClient.js`** — client component siguiendo el patrón de `EvalClient.js` (guard de auth con `useEffect`/`router.replace`, `useT("analytics")`, `useState`, try/catch con `err.message`). Implementa el comportamiento 1-7 de arriba. Estructura de referencia:

```jsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getProperties, createProperty, previewUpload, commitUpload,
} from "../../../lib/api";
import { isAuthenticated } from "../../../lib/session";
import { deriveCompanies, activeProperties, isAcceptedFile } from "../../../lib/analytics";
import { useT } from "../../../i18n/client";
import styles from "./page.module.css";

export default function AnalyticsUploadClient() {
  const t = useT("analytics");
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [properties, setProperties] = useState(null);
  const [propsError, setPropsError] = useState(null);
  const [selectedId, setSelectedId] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCurrency, setNewCurrency] = useState("USD");
  const [newCompId, setNewCompId] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState(null);
  const [committed, setCommitted] = useState(null);

  useEffect(() => {
    if (!isAuthenticated()) { router.replace("/login?next=/dashboard/analytics"); return; }
    setReady(true);
  }, [router]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    getProperties()
      .then((list) => { if (!cancelled) setProperties(list); })
      .catch((err) => { if (!cancelled) { setPropsError(err.message || t("unavailable")); setProperties([]); } });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  if (!ready) return null;

  const companies = deriveCompanies(properties || []);
  const showCompanySelect = companies.length > 1;
  const activeList = activeProperties(properties || []);

  function handleFile(e) {
    const f = e.target.files?.[0] || null;
    setSummary(null); setCommitted(null); setPreviewError(null); setConfirmError(null);
    if (f && !isAcceptedFile(f.name)) { setFile(null); setFileError(t("fileTypeError")); return; }
    setFileError(null); setFile(f);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setCreateError(null); setCreating(true);
    try {
      const payload = { name: newName, currency: newCurrency };
      if (showCompanySelect) payload.comp_id = Number(newCompId);
      const data = await createProperty(payload);
      const created = data.property;
      const list = await getProperties();
      setProperties(list);
      setSelectedId(String(created.id));
      setShowNew(false); setNewName(""); setNewCurrency("USD"); setNewCompId("");
    } catch (err) { setCreateError(err.message || t("unavailable")); }
    finally { setCreating(false); }
  }

  async function handlePreview() {
    setPreviewError(null); setSummary(null); setCommitted(null); setPreviewing(true);
    try {
      const data = await previewUpload(selectedId, file);
      setSummary(data.summary);
    } catch (err) { setPreviewError(err.message || t("unavailable")); }
    finally { setPreviewing(false); }
  }

  async function handleConfirm() {
    setConfirmError(null); setConfirming(true);
    try {
      const data = await commitUpload(selectedId, file);
      setCommitted(data.summary);
    } catch (err) { setConfirmError(err.message || t("unavailable")); }
    finally { setConfirming(false); }
  }

  const canPreview = selectedId && file && !fileError;

  return (
    <section className={styles.card}>
      {/* Selector de propiedad */}
      <label className={styles.field}>
        <span className={styles.fieldLabel}>{t("selectProperty")}</span>
        {properties === null ? (
          <p className={styles.muted}>{t("loading")}</p>
        ) : propsError ? (
          <div className={styles.error} role="alert">{propsError}</div>
        ) : (
          <select className={styles.select} value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}>
            <option value="">{t("selectProperty")}</option>
            {activeList.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
      </label>

      <button type="button" className={styles.ghostButton} onClick={() => setShowNew((v) => !v)}>
        {t("addNew")}
      </button>

      {showNew && (
        <form className={styles.newForm} onSubmit={handleCreate}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>{t("name")}</span>
            <input className={styles.input} value={newName}
              onChange={(e) => setNewName(e.target.value)} required />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>{t("currency")}</span>
            <select className={styles.select} value={newCurrency}
              onChange={(e) => setNewCurrency(e.target.value)}>
              <option value="USD">USD</option>
              <option value="COP">COP</option>
            </select>
          </label>
          {showCompanySelect && (
            <label className={styles.field}>
              <span className={styles.fieldLabel}>{t("company")}</span>
              <select className={styles.select} value={newCompId}
                onChange={(e) => setNewCompId(e.target.value)} required>
                <option value="">{t("company")}</option>
                {companies.map((c) => (
                  <option key={c.comp_id} value={c.comp_id}>{c.company_name}</option>
                ))}
              </select>
            </label>
          )}
          {createError && <div className={styles.error} role="alert">{createError}</div>}
          <div className={styles.actionsRow}>
            <button type="button" className={styles.ghostButton} onClick={() => setShowNew(false)}>
              {t("cancel")}
            </button>
            <button type="submit" className="btn-primary" disabled={creating}>
              {creating ? t("loading") : t("save")}
            </button>
          </div>
        </form>
      )}

      {/* Archivo */}
      <label className={styles.field}>
        <span className={styles.fieldLabel}>{t("chooseFile")}</span>
        <input type="file" accept=".zip,.csv" onChange={handleFile} />
        <span className={styles.muted}>{t("fileHint")}</span>
      </label>
      {fileError && <div className={styles.error} role="alert">{fileError}</div>}

      {/* Vista previa */}
      <button type="button" className={styles.ghostButton} onClick={handlePreview}
        disabled={!canPreview || previewing}>
        {previewing ? t("previewLoading") : t("preview")}
      </button>
      {previewError && <div className={styles.error} role="alert">{previewError}</div>}

      {summary && !committed && (
        <div className={styles.summary}>
          <p>{t("summaryProperty")}: {summary.property_name}</p>
          <p>{t("summaryRows")}: {summary.row_count}</p>
          <p>{t("summaryPeriod")}: {summary.period_start} – {summary.period_end}</p>
          <p>{t("summaryNet")}: {summary.net_sales_total}</p>
          {confirmError && <div className={styles.error} role="alert">{confirmError}</div>}
          <button type="button" className="btn-primary" onClick={handleConfirm} disabled={confirming}>
            {confirming ? t("confirmLoading") : t("confirm")}
          </button>
        </div>
      )}

      {committed && (
        <div className={styles.success} role="status">
          {t("uploadSuccess")} ({committed.row_count})
        </div>
      )}

      <div className={styles.selectFooter}>
        <a className={styles.link} href="/dashboard/analytics/properties">
          {t("managePropertiesLink")}
        </a>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Crear `page.module.css`** siguiendo `eval/page.module.css` y los design tokens (reutiliza nombres: `.page`, `.wrapper`, `.h1`, `.card`, `.field`, `.fieldLabel`, `.select`, `.input`, `.muted`, `.error`, `.success`, `.ghostButton`, `.actionsRow`, `.newForm`, `.summary`, `.selectFooter`, `.link`). Usar SOLO tokens (colores/espaciado), esquinas rectas, y `@media (prefers-reduced-motion)` si hay transición. Copiar el estilo base de `eval/page.module.css` y ajustar.

- [ ] **Step 6: Añadir claves i18n** — en `src/i18n/messages/en.json` y `src/i18n/messages/es.json`, agregar el namespace `"analytics"` con TODAS las claves listadas en el contrato (Step 0 del task). Ejemplo (en.json):
```json
"analytics": {
  "uploadTitle": "Upload sales",
  "selectProperty": "Property",
  "addNew": "+ Add new property",
  "name": "Name",
  "currency": "Currency",
  "company": "Company",
  "save": "Save",
  "cancel": "Cancel",
  "chooseFile": "Sales export file",
  "fileHint": "Upload the Toast export (ZIP) or the Sales by day.csv file.",
  "fileTypeError": "Please choose a .zip or .csv file.",
  "preview": "Preview",
  "previewLoading": "Checking…",
  "confirm": "Confirm upload",
  "confirmLoading": "Saving…",
  "summaryRows": "Rows",
  "summaryPeriod": "Period",
  "summaryNet": "Net sales total",
  "summaryProperty": "Property",
  "uploadSuccess": "Sales uploaded successfully",
  "managePropertiesLink": "Manage my properties",
  "loading": "Loading…",
  "unavailable": "This is unavailable right now.",
  "needProperty": "Choose a property first.",
  "needFile": "Choose a file first."
}
```
(es.json: mismas claves, en español — p.ej. `"uploadTitle": "Cargar ventas"`, `"selectProperty": "Propiedad"`, `"addNew": "+ Agregar propiedad"`, `"chooseFile": "Archivo del export de ventas"`, `"fileHint": "Sube el export de Toast (ZIP) o el archivo Sales by day.csv."`, etc.)

- [ ] **Step 7: Correr el test para verificar que pasa**

Run: `npx vitest run src/app/dashboard/analytics/__tests__/AnalyticsUploadClient.test.js`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/app/dashboard/analytics/ src/i18n/messages/en.json src/i18n/messages/es.json
git commit -m "feat(analytics-fe): pantalla Cargar ventas (selector/alta de propiedad + ZIP/CSV + preview/confirm)"
```

---

### Task 3: Pantalla "Mis propiedades" (`app/dashboard/analytics/properties/`)

**Files:**
- Create: `src/app/dashboard/analytics/properties/page.js`
- Create: `src/app/dashboard/analytics/properties/PropertiesClient.js`
- Create: `src/app/dashboard/analytics/properties/page.module.css`
- Modify: `src/i18n/messages/en.json` y `src/i18n/messages/es.json` (añadir claves al namespace `analytics`)
- Test: `src/app/dashboard/analytics/properties/__tests__/PropertiesClient.test.js`

**Interfaces:**
- Consumes de Task 1: `getProperties`, `createProperty`, `updateProperty`, `deriveCompanies`; `isAuthenticated`, `useT`.
- Produces: ruta `/dashboard/analytics/properties`.

**Comportamiento:**
1. Guard: sin sesión → `router.replace("/login?next=/dashboard/analytics/properties")`.
2. Carga `getProperties()` (todas: activas e inactivas). Lista cada una con: nombre, moneda, compañía (solo si `deriveCompanies(...).length > 1`), estado (activa/inactiva).
3. **Renombrar:** edición inline (botón "Renombrar" → input + guardar) → `updateProperty(id, { name })`. Recarga la lista; error inline.
4. **Activar/Desactivar:** toggle → `updateProperty(id, { active: !active })`. Recarga; error inline.
5. **Agregar propiedad:** mismo mini-form que en Cargar (nombre + moneda + compañía si aplica) → `createProperty(...)` → recarga.
6. Enlace a **"Cargar ventas"** (`/dashboard/analytics`).

**Claves i18n a añadir al namespace `analytics`:** `propertiesTitle, rename, activate, deactivate, active, inactive, addProperty, empty, saveName`. (Reutiliza `name, currency, company, save, cancel, loading, unavailable` de Task 2.)

- [ ] **Step 1: Escribir el test que falla** — `.../properties/__tests__/PropertiesClient.test.js`:

```js
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
const isAuthenticated = vi.fn();
vi.mock("../../../../../lib/session", () => ({ isAuthenticated: (...a) => isAuthenticated(...a) }));

const getProperties = vi.fn();
const createProperty = vi.fn();
const updateProperty = vi.fn();
vi.mock("../../../../../lib/api", () => ({
  getProperties: (...a) => getProperties(...a),
  createProperty: (...a) => createProperty(...a),
  updateProperty: (...a) => updateProperty(...a),
}));

import PropertiesClient from "../PropertiesClient";

afterEach(cleanup);
beforeEach(() => {
  replace.mockClear();
  isAuthenticated.mockReset(); getProperties.mockReset();
  createProperty.mockReset(); updateProperty.mockReset();
});

describe("PropertiesClient", () => {
  it("redirige a login sin sesión", () => {
    isAuthenticated.mockReturnValue(false);
    render(<PropertiesClient />);
    expect(replace).toHaveBeenCalledWith("/login?next=/dashboard/analytics/properties");
  });

  it("lista propiedades y permite desactivar", async () => {
    isAuthenticated.mockReturnValue(true);
    getProperties
      .mockResolvedValueOnce([{ id: 1, name: "Rooftop", currency: "USD", active: true, comp_id: 1, company_name: "Distinct" }])
      .mockResolvedValueOnce([{ id: 1, name: "Rooftop", currency: "USD", active: false, comp_id: 1, company_name: "Distinct" }]);
    updateProperty.mockResolvedValue({ property: { id: 1, name: "Rooftop", currency: "USD", active: false } });
    render(<PropertiesClient />);
    await waitFor(() => expect(screen.getByText("Rooftop")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /deactivate|desactivar/i }));
    await waitFor(() => expect(updateProperty).toHaveBeenCalledWith(1, { active: false }));
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run src/app/dashboard/analytics/properties/__tests__/PropertiesClient.test.js`
Expected: FAIL — no existe `../PropertiesClient`.

- [ ] **Step 3: Crear `page.js`** (patrón idéntico a Task 2 pero `getT("analytics")` con `t("propertiesTitle")` y renderiza `<PropertiesClient />`).

```jsx
import PropertiesClient from "./PropertiesClient";
import { getT } from "../../../../i18n/server";
import styles from "./page.module.css";

export const metadata = {
  title: "My properties | Distinct Hospitality Solutions",
  description: "Manage your properties.",
};

export default async function PropertiesPage() {
  const t = await getT("analytics");
  return (
    <div className={styles.page}>
      <div className={`container ${styles.wrapper}`}>
        <h1 className={styles.h1}>{t("propertiesTitle")}</h1>
        <PropertiesClient />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Crear `PropertiesClient.js`** — client component con el comportamiento 1-6. Sigue el patrón de estado/guard/try-catch de `AnalyticsUploadClient` (Task 2, código completo — úsalo como plantilla). **OJO con la profundidad de imports:** esta carpeta está un nivel más adentro que la de Cargar, así que los imports suben 4 niveles: `from "../../../../lib/api"`, `from "../../../../lib/session"`, `from "../../../../lib/analytics"`, `from "../../../../i18n/client"` (y `styles from "./page.module.css"`). Debe: cargar propiedades; render de lista con nombre/moneda/(compañía si aplica)/estado; renombrar inline (`updateProperty(id,{name})`); toggle activar/desactivar (`updateProperty(id,{active:!p.active})` — el botón muestra "Desactivar" si `active`, "Activar" si no); mini-form de alta (`createProperty`); recargar `getProperties()` tras cada mutación; errores con `err.message`. Enlace a `/dashboard/analytics`. Usar `useT("analytics")`, clases de `page.module.css`, `.btn-primary` para acciones primarias.

- [ ] **Step 5: Crear `page.module.css`** (reutiliza el estilo de Task 2 / eval; tokens; esquinas rectas). Puede copiar `../page.module.css` y añadir `.propItem`, `.propInfo`, `.badgeActive`, `.badgeInactive`.

- [ ] **Step 6: Añadir claves i18n** al namespace `analytics` (en.json y es.json): `propertiesTitle` ("My properties"/"Mis propiedades"), `rename`, `activate`, `deactivate`, `active`, `inactive`, `addProperty`, `empty`, `saveName`.

- [ ] **Step 7: Correr el test para verificar que pasa**

Run: `npx vitest run src/app/dashboard/analytics/properties/__tests__/PropertiesClient.test.js`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/app/dashboard/analytics/properties/ src/i18n/messages/en.json src/i18n/messages/es.json
git commit -m "feat(analytics-fe): pantalla Mis propiedades (listar/renombrar/activar-desactivar/agregar)"
```

---

### Task 4: Enlace de menú (frontend) + i18n de la etiqueta

**Files:**
- Modify: `src/lib/menuTargets.js` (`resolveMenuTarget` + `MENU_LABEL_KEYS`)
- Modify: `src/i18n/messages/en.json` y `src/i18n/messages/es.json` (clave `analytics` en el namespace `menu`)
- Test: `src/lib/menuTargets.test.js` (añadir casos)

**Interfaces:**
- Consumes: el item de menú con `url === "dashboard/analytics"` que se sembrará en la BD (paso de deploy).
- Produces: el menú "Cargar ventas" enlaza a `/dashboard/analytics` en vez de `/coming-soon`.

**Contexto:** el menú es data-driven. `resolveMenuTarget(page)` hoy solo mapea `dashboard/eval` a ruta; todo lo demás cae a `/coming-soon`. Se agrega el caso `dashboard/analytics`. La fila de menú y sus permisos por rol se siembran en la BD (ver Notas de despliegue) — este task solo hace el mapeo en el frontend.

- [ ] **Step 1: Añadir el test que falla** — en `src/lib/menuTargets.test.js`, agregar:
```js
it("mapea dashboard/analytics a su ruta", () => {
  expect(resolveMenuTarget("dashboard/analytics")).toEqual({
    type: "route", href: "/dashboard/analytics",
  });
});
it("da la clave i18n analytics para dashboard/analytics", () => {
  expect(menuLabelKey("dashboard/analytics")).toBe("analytics");
});
```
(Asegurarse de que `resolveMenuTarget` y `menuLabelKey` estén importados en el archivo de test; si no, añadirlos al import existente.)

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run src/lib/menuTargets.test.js`
Expected: FAIL — hoy `resolveMenuTarget("dashboard/analytics")` devuelve `{type:"route",href:"/coming-soon"}` y `menuLabelKey` devuelve `null`.

- [ ] **Step 3: Implementar**

En `src/lib/menuTargets.js`, en `resolveMenuTarget`, añadir antes del `return` final:
```js
  if (key === "dashboard/analytics") return { type: "route", href: "/dashboard/analytics" };
```
Y en `MENU_LABEL_KEYS`, añadir la entrada:
```js
  "dashboard/analytics": "analytics",
```

- [ ] **Step 4: Añadir la etiqueta i18n del menú** — en `src/i18n/messages/en.json` y `es.json`, dentro del namespace `"menu"`, añadir `"analytics"` ("Sales"/"Ventas" — texto corto para el chip del menú; NO usar "Analytics" si prefieres, pero mantener consistencia en ambos idiomas).

- [ ] **Step 5: Correr el test para verificar que pasa**

Run: `npx vitest run src/lib/menuTargets.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/menuTargets.js src/lib/menuTargets.test.js src/i18n/messages/en.json src/i18n/messages/es.json
git commit -m "feat(analytics-fe): enlace de menu a Cargar ventas (resolveMenuTarget + etiqueta i18n)"
```

---

### Task 5: Verificación de la suite completa

- [ ] **Step 1: Correr toda la suite de vitest**

Run (desde `distinct_app_frontend`): `npx vitest run`
Expected: PASS. Sin romper tests existentes (eval, menuTargets, etc.). Salida sin errores.

- [ ] **Step 2: (Si algo falla) diagnosticar y corregir** sin marcar la tarea completa con tests en rojo.

---

## Notas de despliegue (post-merge, MANUAL — las hace el controlador por MCP Supabase)

1. **Sembrar la fila de menú** en `public.menu`:
   `INSERT INTO public.menu (page, title, men_description, icon, is_default, menu_group) VALUES ('dashboard/analytics', 'Sales', 'Sales upload & properties', ':material/point_of_sale:', false, 'DASHBOARD');`
   (Confirmar el `men_id` generado.)
2. **Dar acceso por rol** en `public.roles_menu` (columnas `men_id`, `rol_id`) para **owner (rol_id=1)** y **admin_company (rol_id=4)**:
   `INSERT INTO public.roles_menu (men_id, rol_id) VALUES (<nuevo_men_id>, 1), (<nuevo_men_id>, 4);`
   (No sembrar para rol 2/3/5.)
3. Verificar en la app que el chip "Sales/Ventas" aparece en el Tablero para esos roles y enlaza a `/dashboard/analytics`.

## Fuera de alcance (YAGNI)

Asignar Editores a propiedades por UI (`user_property`) · gráficos/reportes (Fase 1) · un endpoint de compañías dedicado (el selector del owner se deriva de las propiedades visibles; crear en una compañía sin propiedades aún se hace por Django admin) · hardening httpOnly de cookies (Fase 4).
