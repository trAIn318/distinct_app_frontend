# Navbar con desplegables (Tablero + Rueda) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir el dashboard en un desplegable de la barra (Tablero) y organizar los accesos del menú por rol en secciones plegables dentro de la rueda (⚙), sin tocar backend ni BD.

**Architecture:** Todo frontend en `distinct_app_frontend`. Se crea un cascarón reutilizable `NavDropdown` (controlado) que usan el Tablero (`DashboardMenu`) y la rueda (`SettingsPanel` refactorizado). Una función pura `splitMenuByGroup` reparte los items de `/api/menu/` por `menu_group`. `/dashboard` deja de ser página: redirige a `/` y abre el Tablero por evento.

**Tech Stack:** Next.js 16 (App Router, React 19), CSS Modules con tokens de diseño, vitest para tests unitarios de funciones puras.

## Global Constraints

- **Cero cambios de backend/BD.** Solo se consumen endpoints existentes: `GET /api/menu/`, `GET /api/dashboard/courses/`, `GET /api/dashboard/training/`.
- **Design system (`distinct_app_frontend/CLAUDE.md`):** solo tokens de diseño (nunca colores/tamaños hardcodeados), `border-radius: 0` salvo el círculo del engranaje ya existente, superficies oscuras (`--color-charcoal`), acento `--color-gold` con moderación.
- **i18n:** textos vía `useT(namespace)`; claves nuevas se añaden a `src/i18n/messages/en.json` y `es.json` en paralelo. Títulos de items del menú: `item.title` como fallback.
- **Degradación elegante:** fallo de menú/Moodle → estado vacío, nunca error que rompa la barra.
- **`menu_group` reales:** `DASHBOARD`, `RECRUITER`, `SETTINGS` (mayúsculas en BD; comparar case-insensitive).
- **Trabajo en el repo `distinct_app_frontend`.** Commits solo en ese repo. No hacer push ni PR salvo que el usuario lo pida.

---

### Task 1: Función pura de reparto y mapeo (`lib/menuTargets.js`)

**Files:**
- Create: `src/lib/menuTargets.js`
- Test: `src/lib/menuTargets.test.js`

**Interfaces:**
- Produces:
  - `splitMenuByGroup(items: Array<{group,key,title,url,icon}>) => { dashboard: [], recruiter: [], settings: [] }`
  - `resolveMenuTarget(url: string) => { type: "train" } | { type: "dash" } | { type: "language" } | { type: "route", href: string }`

- [ ] **Step 1: Write the failing test**

Create `src/lib/menuTargets.test.js`:

```js
import { describe, it, expect } from "vitest";
import { splitMenuByGroup, resolveMenuTarget } from "./menuTargets";

describe("splitMenuByGroup", () => {
  it("reparte items por menu_group (case-insensitive)", () => {
    const items = [
      { group: "DASHBOARD", url: "dashboard/dash", title: "Dash" },
      { group: "recruiter", url: "recruiter/load_cvs", title: "Load CVs" },
      { group: "SETTINGS", url: "settings/language", title: "Language" },
    ];
    const out = splitMenuByGroup(items);
    expect(out.dashboard).toHaveLength(1);
    expect(out.recruiter).toHaveLength(1);
    expect(out.settings).toHaveLength(1);
    expect(out.dashboard[0].title).toBe("Dash");
  });

  it("ignora grupos desconocidos y entradas nulas sin romper", () => {
    const out = splitMenuByGroup([{ group: "WEIRD", url: "x" }, null, {}]);
    expect(out).toEqual({ dashboard: [], recruiter: [], settings: [] });
  });

  it("devuelve buckets vacíos con entrada vacía o undefined", () => {
    expect(splitMenuByGroup(undefined)).toEqual({ dashboard: [], recruiter: [], settings: [] });
    expect(splitMenuByGroup([])).toEqual({ dashboard: [], recruiter: [], settings: [] });
  });
});

describe("resolveMenuTarget", () => {
  it("mapea rutas conocidas", () => {
    expect(resolveMenuTarget("dashboard/trainy")).toEqual({ type: "train" });
    expect(resolveMenuTarget("/dashboard/trainy")).toEqual({ type: "train" });
    expect(resolveMenuTarget("dashboard/dash")).toEqual({ type: "dash" });
    expect(resolveMenuTarget("settings/language")).toEqual({ type: "language" });
  });

  it("todo lo demás cae a /coming-soon", () => {
    expect(resolveMenuTarget("recruiter/load_cvs")).toEqual({ type: "route", href: "/coming-soon" });
    expect(resolveMenuTarget("")).toEqual({ type: "route", href: "/coming-soon" });
    expect(resolveMenuTarget(undefined)).toEqual({ type: "route", href: "/coming-soon" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/menuTargets.test.js`
Expected: FAIL — "Failed to resolve import './menuTargets'" o "splitMenuByGroup is not a function".

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/menuTargets.js`:

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/menuTargets.test.js`
Expected: PASS (todos los casos verdes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/menuTargets.js src/lib/menuTargets.test.js
git commit -m "feat(menu): splitMenuByGroup + resolveMenuTarget (funciones puras testeadas)"
```

---

### Task 2: Claves i18n nuevas

**Files:**
- Modify: `src/i18n/messages/en.json`
- Modify: `src/i18n/messages/es.json`

**Interfaces:**
- Produces: claves `dashboard.loading`, `settings.recruiter` (y reutiliza `dashboard.title`, `dashboard.coursesTitle`, `dashboard.empty`, `dashboard.trainCta`, `dashboard.trainLoading`, `dashboard.trainError`, `settings.title`, `settings.language`, `settings.theme`, `settings.dark`, `settings.light`, `settings.note`).

- [ ] **Step 1: Añadir clave en `en.json`**

En el objeto `"dashboard"` (tras `"empty"`), añade `"loading"`:

```json
    "empty": "You have no courses in Moodle yet.",
    "loading": "Loading…",
    "menuTitle": "Quick links",
```

En el objeto `"settings"` (tras `"title"`), añade `"recruiter"`:

```json
  "settings": {
    "title": "Settings",
    "recruiter": "Recruiter",
    "language": "Language",
```

- [ ] **Step 2: Añadir la misma clave en `es.json`**

En el objeto `"dashboard"` (tras `"empty"`):

```json
    "empty": "Aún no tienes cursos en Moodle.",
    "loading": "Cargando…",
    "menuTitle": "Accesos rápidos",
```

En el objeto `"settings"` (tras `"title"`):

```json
  "settings": {
    "title": "Configuración",
    "recruiter": "Reclutador",
    "language": "Idioma",
```

- [ ] **Step 3: Verificar que el JSON es válido**

Run: `node -e "require('./src/i18n/messages/en.json'); require('./src/i18n/messages/es.json'); console.log('ok')"`
Expected: imprime `ok` (sin errores de parseo).

- [ ] **Step 4: Commit**

```bash
git add src/i18n/messages/en.json src/i18n/messages/es.json
git commit -m "i18n: claves dashboard.loading y settings.recruiter"
```

---

### Task 3: Cascarón reutilizable `NavDropdown`

**Files:**
- Create: `src/components/NavDropdown.js`
- Create: `src/components/NavDropdown.module.css`

**Interfaces:**
- Consumes: nada de tareas previas.
- Produces: componente controlado
  `NavDropdown({ open: boolean, onOpenChange: (next:boolean)=>void, label: string, trigger: ReactNode, triggerClassName?: string, align?: "start"|"end", children: ReactNode })`.
  El padre es dueño del estado `open`. `NavDropdown` gestiona `Escape`, clic-fuera, `aria-expanded`, panel responsive (popover en escritorio, a lo ancho en móvil).

- [ ] **Step 1: Crear el componente**

Create `src/components/NavDropdown.js`:

```jsx
"use client";

/**
 * NavDropdown — cascarón controlado para desplegables de la barra.
 * El padre posee `open` y recibe `onOpenChange`. Este componente solo:
 *   - pinta el trigger (con aria-expanded/aria-haspopup),
 *   - cierra con Escape y clic-fuera,
 *   - coloca el panel (popover en escritorio, a lo ancho en móvil vía CSS).
 * No sabe nada de cursos ni de settings — solo abre/cierra y ubica el panel.
 */

import { useEffect, useRef } from "react";
import styles from "./NavDropdown.module.css";

export default function NavDropdown({
  open,
  onOpenChange,
  label,
  trigger,
  triggerClassName = "",
  align = "end",
  children,
}) {
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    const onClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open, onOpenChange]);

  return (
    <div ref={rootRef} className={styles.root}>
      <button
        type="button"
        className={`${styles.trigger} ${triggerClassName}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
        onClick={() => onOpenChange(!open)}
      >
        {trigger}
      </button>
      {open && (
        <div
          className={`${styles.panel} ${align === "start" ? styles.alignStart : styles.alignEnd}`}
          role="dialog"
          aria-label={label}
        >
          {children}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Crear los estilos**

Create `src/components/NavDropdown.module.css`:

```css
/* NavDropdown — trigger + panel (popover en escritorio, a lo ancho en móvil) */

.root {
  position: relative;
  display: inline-flex;
}

.trigger {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  background: transparent;
  border: none;
  cursor: pointer;
  color: inherit;
}

.panel {
  position: absolute;
  top: calc(100% + var(--space-3));
  width: min(360px, 92vw);
  background: var(--color-charcoal);
  border: 1px solid var(--gold-30);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.4);
  z-index: 300;
  padding: var(--space-5);
  animation: navDropIn 0.2s var(--ease-smooth);
}

.alignEnd {
  right: 0;
}

.alignStart {
  left: 0;
}

@keyframes navDropIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .panel {
    animation: none;
  }
}

/* Móvil: el panel ocupa el ancho completo bajo la barra */
@media (max-width: 768px) {
  .panel {
    position: fixed;
    top: 64px;
    left: 0;
    right: 0;
    width: 100vw;
    max-height: calc(100dvh - 64px);
    overflow-y: auto;
    border-left: none;
    border-right: none;
  }
}
```

- [ ] **Step 3: Verificar build y lint**

Run: `npm run build`
Expected: "✓ Compiled successfully" (el componente aún no se usa; solo debe compilar).

Run: `npx eslint src/components/NavDropdown.js`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/components/NavDropdown.js src/components/NavDropdown.module.css
git commit -m "feat(nav): NavDropdown reutilizable (controlado, responsive)"
```

---

### Task 4: Desplegable Tablero (`DashboardMenu`)

**Files:**
- Create: `src/components/DashboardMenu.js`
- Create: `src/components/DashboardMenu.module.css`

**Interfaces:**
- Consumes:
  - `NavDropdown` (Task 3).
  - `splitMenuByGroup`, `resolveMenuTarget` (Task 1).
  - `getDashboardCourses`, `startTraining` de `src/lib/api.js`.
  - `resolveCourseImage` de `src/lib/config.js`.
- Produces: `DashboardMenu({ menu?: Array })` — trigger "Tablero" + panel con progreso de cursos, botón Entrenar y accesos secundarios (Eval/Pay). Carga cursos de forma perezosa (primera apertura) y escucha el evento `distinct:open-dashboard`.

- [ ] **Step 1: Crear el componente**

Create `src/components/DashboardMenu.js`:

```jsx
"use client";

/**
 * DashboardMenu — el "Tablero" como desplegable de la barra.
 * Muestra progreso de cursos (miniatura + nombre + barra), el botón Entrenar
 * (SSO a Moodle) y los accesos secundarios del grupo DASHBOARD (Eval/Pay).
 * Carga los cursos la primera vez que se abre. Se abre también por el evento
 * `distinct:open-dashboard` (que dispara el redirect de /dashboard).
 */

import { useCallback, useEffect, useState } from "react";
import NavDropdown from "./NavDropdown";
import { getDashboardCourses, startTraining } from "../lib/api";
import { splitMenuByGroup, resolveMenuTarget } from "../lib/menuTargets";
import { resolveCourseImage } from "../lib/config";
import { useT } from "../i18n/client";
import styles from "./DashboardMenu.module.css";

const COURSE_IMAGE_FALLBACK = "/img/courses/under_construction.jpg";

export default function DashboardMenu({ menu = [] }) {
  const t = useT("dashboard");
  const [open, setOpen] = useState(false);
  const [courses, setCourses] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [training, setTraining] = useState(false);
  const [trainError, setTrainError] = useState(null);

  const load = useCallback(() => {
    if (loaded) return;
    setLoaded(true);
    getDashboardCourses().then((d) => setCourses(d.courses || []));
  }, [loaded]);

  useEffect(() => {
    const openMenu = () => {
      setOpen(true);
      load();
    };
    window.addEventListener("distinct:open-dashboard", openMenu);
    return () => window.removeEventListener("distinct:open-dashboard", openMenu);
  }, [load]);

  const handleOpenChange = (next) => {
    setOpen(next);
    if (next) load();
  };

  async function handleTrain() {
    setTrainError(null);
    setTraining(true);
    try {
      const url = await startTraining();
      if (!url) {
        setTrainError(t("trainError"));
        setTraining(false);
        return;
      }
      window.location.href = url;
    } catch {
      setTrainError(t("trainError"));
      setTraining(false);
    }
  }

  const extraLinks = splitMenuByGroup(menu).dashboard.filter(
    (it) => resolveMenuTarget(it.url).type === "route"
  );

  return (
    <NavDropdown
      open={open}
      onOpenChange={handleOpenChange}
      align="end"
      label={t("title")}
      triggerClassName={styles.trigger}
      trigger={<span>{t("title")}</span>}
    >
      <div className={styles.panelInner}>
        <h2 className={styles.sectionTitle}>{t("coursesTitle")}</h2>

        {courses === null ? (
          <p className={styles.muted}>{t("loading")}</p>
        ) : courses.length === 0 ? (
          <p className={styles.muted}>{t("empty")}</p>
        ) : (
          <ul className={styles.courseList}>
            {courses.map((c) => {
              const pct = c.progress != null ? Math.round(c.progress) : null;
              return (
                <li key={c.id} className={styles.courseItem}>
                  <a
                    className={styles.courseLink}
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className={styles.courseThumbWrap}>
                      <img
                        className={styles.courseThumb}
                        src={resolveCourseImage(c.image)}
                        alt={c.name}
                        loading="lazy"
                        onError={(e) => {
                          if (e.currentTarget.src.indexOf(COURSE_IMAGE_FALLBACK) === -1) {
                            e.currentTarget.src = COURSE_IMAGE_FALLBACK;
                          }
                        }}
                      />
                    </span>
                    <span className={styles.courseInfo}>
                      <span className={styles.courseName}>{c.name}</span>
                      {pct != null && (
                        <span className={styles.progressRow}>
                          <span className={styles.progressTrack}>
                            <span className={styles.progressFill} style={{ width: `${pct}%` }} />
                          </span>
                          <span className={styles.progressLabel}>{pct}%</span>
                        </span>
                      )}
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        )}

        <button
          type="button"
          className="btn-primary"
          onClick={handleTrain}
          disabled={training}
        >
          {training ? t("trainLoading") : t("trainCta")}
        </button>
        {trainError && (
          <div className={styles.error} role="alert">{trainError}</div>
        )}

        {extraLinks.length > 0 && (
          <ul className={styles.linkList}>
            {extraLinks.map((it) => (
              <li key={it.url}>
                <a className={styles.link} href={resolveMenuTarget(it.url).href}>
                  {it.title}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </NavDropdown>
  );
}
```

- [ ] **Step 2: Crear los estilos**

Create `src/components/DashboardMenu.module.css`:

```css
/* DashboardMenu — contenido del desplegable Tablero */

.trigger {
  color: var(--color-ivory);
  font-family: var(--font-body);
  font-size: var(--text-sm);
  letter-spacing: 0.06em;
  padding: var(--space-2) var(--space-3);
  border: 1px solid transparent;
  transition:
    color var(--duration-fast) var(--ease-smooth),
    border-color var(--duration-fast) var(--ease-smooth);
}

.trigger:hover,
.trigger[aria-expanded="true"] {
  color: var(--color-gold);
  border-color: var(--gold-30);
}

.panelInner {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.sectionTitle {
  font-family: var(--font-label);
  font-size: var(--text-xs);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--color-gold);
  margin: 0;
}

.muted {
  color: var(--color-smoke);
  font-size: var(--text-sm);
  margin: 0;
}

.courseList {
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 320px;
  overflow-y: auto;
}

.courseItem {
  border-bottom: 1px solid var(--ivory-08);
}

.courseItem:last-child {
  border-bottom: none;
}

.courseLink {
  display: flex;
  gap: var(--space-4);
  align-items: center;
  padding: var(--space-3) 0;
  text-decoration: none;
  color: var(--color-ivory);
}

.courseThumbWrap {
  flex: 0 0 auto;
  width: 72px;
  height: 44px;
  overflow: hidden;
  border: 1px solid var(--ivory-15);
  background: var(--color-obsidian);
}

.courseThumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.courseInfo {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.courseName {
  font-family: var(--font-body);
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--color-ivory);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.courseLink:hover .courseName {
  color: var(--color-gold);
}

.progressRow {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.progressTrack {
  flex: 1 1 auto;
  height: 5px;
  overflow: hidden;
  background: var(--ivory-15);
}

.progressFill {
  display: block;
  height: 100%;
  background: var(--color-gold);
}

.progressLabel {
  flex: 0 0 auto;
  min-width: 3ch;
  text-align: right;
  font-family: var(--font-label);
  font-size: var(--text-xs);
  color: var(--color-smoke);
}

.linkList {
  list-style: none;
  padding: var(--space-3) 0 0;
  margin: 0;
  border-top: 1px solid var(--ivory-08);
  display: flex;
  gap: var(--space-4);
}

.link {
  color: var(--color-platinum);
  text-decoration: none;
  font-size: var(--text-sm);
}

.link:hover {
  color: var(--color-gold);
}

.error {
  background: var(--color-danger-surface);
  border-left: 2px solid var(--color-danger);
  color: var(--color-danger);
  padding: var(--space-3) var(--space-4);
  font-family: var(--font-body);
  font-size: var(--text-sm);
}
```

- [ ] **Step 3: Verificar build y lint**

Run: `npm run build`
Expected: "✓ Compiled successfully".

Run: `npx eslint src/components/DashboardMenu.js`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/components/DashboardMenu.js src/components/DashboardMenu.module.css
git commit -m "feat(nav): desplegable Tablero (progreso + Entrenar + accesos)"
```

---

### Task 5: Rueda como desplegable con secciones (`SettingsPanel` refactor)

**Files:**
- Modify: `src/components/SettingsPanel.js` (reescritura completa)
- Modify: `src/components/SettingsPanel.module.css` (reemplaza estilos de slide-over por estilos de secciones; conserva `.gearButton`, `.settingGroup`, `.settingLabel`, `.segmented`, `.segment`, `.segmentActive`, `.note`)

**Interfaces:**
- Consumes: `NavDropdown` (Task 3); `splitMenuByGroup`, `resolveMenuTarget` (Task 1); helpers de `src/lib/preferences.js` (ya existentes).
- Produces: `SettingsPanel({ menu?: Array })` — trigger engranaje + panel con secciones plegables RECLUTADOR (si aplica) y CONFIGURACIÓN (enlaces + Idioma + Tema).

- [ ] **Step 1: Reescribir el componente**

Replace el contenido completo de `src/components/SettingsPanel.js` con:

```jsx
"use client";

/**
 * SettingsPanel — engranaje ⚙ como desplegable de la barra.
 * Contiene secciones plegables:
 *   - RECLUTADOR: accesos del grupo RECRUITER del rol (→ /coming-soon).
 *   - CONFIGURACIÓN: accesos del grupo SETTINGS (→ /coming-soon) + los
 *     controles reales de Idioma y Tema.
 * Sin sesión (menu vacío) muestra solo Idioma + Tema.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  SUPPORTED_LANGUAGES,
  getStoredTheme,
  getStoredLanguage,
  setTheme as persistTheme,
  setLanguage as persistLanguage,
  applyTheme,
  loadServerPreferences,
} from "../lib/preferences";
import { splitMenuByGroup, resolveMenuTarget } from "../lib/menuTargets";
import NavDropdown from "./NavDropdown";
import { useT } from "../i18n/client";
import styles from "./SettingsPanel.module.css";

export default function SettingsPanel({ menu = [] }) {
  const t = useT("settings");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [theme, setThemeState] = useState("dark");
  const [language, setLanguageState] = useState("en");

  useEffect(() => {
    const localTheme = getStoredTheme();
    setThemeState(localTheme);
    applyTheme(localTheme);
    setLanguageState(getStoredLanguage());
    loadServerPreferences().then((prefs) => {
      if (!prefs) return;
      if (prefs.theme) setThemeState(prefs.theme);
      if (prefs.ui_language) setLanguageState(prefs.ui_language);
    });
  }, []);

  // Permite abrir el panel desde otros componentes (compat con acceso "Language")
  useEffect(() => {
    const openPanel = () => setOpen(true);
    window.addEventListener("distinct:open-settings", openPanel);
    return () => window.removeEventListener("distinct:open-settings", openPanel);
  }, []);

  const handleTheme = useCallback((val) => {
    setThemeState(val);
    persistTheme(val);
  }, []);

  const handleLanguage = useCallback(
    (code) => {
      setLanguageState(code);
      persistLanguage(code);
      router.refresh();
    },
    [router]
  );

  const grouped = splitMenuByGroup(menu);
  const settingsLinks = grouped.settings.filter(
    (it) => resolveMenuTarget(it.url).type === "route"
  );

  const gearIcon = (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );

  return (
    <NavDropdown
      open={open}
      onOpenChange={setOpen}
      align="end"
      label={t("title")}
      triggerClassName={styles.gearButton}
      trigger={gearIcon}
    >
      <div className={styles.panelBody}>
        {grouped.recruiter.length > 0 && (
          <details className={styles.section} open>
            <summary className={styles.sectionSummary}>{t("recruiter")}</summary>
            <ul className={styles.linkList}>
              {grouped.recruiter.map((it) => (
                <li key={it.url}>
                  <a className={styles.link} href={resolveMenuTarget(it.url).href}>
                    {it.title}
                  </a>
                </li>
              ))}
            </ul>
          </details>
        )}

        <details className={styles.section} open>
          <summary className={styles.sectionSummary}>{t("title")}</summary>

          {settingsLinks.length > 0 && (
            <ul className={styles.linkList}>
              {settingsLinks.map((it) => (
                <li key={it.url}>
                  <a className={styles.link} href={resolveMenuTarget(it.url).href}>
                    {it.title}
                  </a>
                </li>
              ))}
            </ul>
          )}

          <div className={styles.settingGroup}>
            <span className={styles.settingLabel}>{t("language")}</span>
            <div className={styles.segmented} role="radiogroup" aria-label="UI language">
              {SUPPORTED_LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  role="radio"
                  aria-checked={language === l.code}
                  className={`${styles.segment} ${language === l.code ? styles.segmentActive : ""}`}
                  onClick={() => handleLanguage(l.code)}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.settingGroup}>
            <span className={styles.settingLabel}>{t("theme")}</span>
            <div className={styles.segmented} role="radiogroup" aria-label="Theme">
              <button
                type="button"
                role="radio"
                aria-checked={theme === "dark"}
                className={`${styles.segment} ${theme === "dark" ? styles.segmentActive : ""}`}
                onClick={() => handleTheme("dark")}
              >
                {t("dark")}
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={theme === "light"}
                className={`${styles.segment} ${theme === "light" ? styles.segmentActive : ""}`}
                onClick={() => handleTheme("light")}
              >
                {t("light")}
              </button>
            </div>
          </div>

          <p className={styles.note}>{t("note")}</p>
        </details>
      </div>
    </NavDropdown>
  );
}
```

- [ ] **Step 2: Ajustar los estilos**

En `src/components/SettingsPanel.module.css`: **elimina** los bloques de slide-over que ya no se usan (`.backdrop`, `.backdropOpen`, `.panel`, `.panelOpen`, `.panelHeader`, `.panelTitle`, `.closeButton`) y **añade** los estilos de secciones. Conserva intactos `.gearButton` (y `.gearButton svg`, `.gearButton:hover`), `.settingGroup`, `.settingLabel`, `.segmented`, `.segment`, `.segment + .segment`, `.segment:hover`, `.segmentActive`, `.note`.

Reemplaza el bloque `.panelBody { ... }` existente por:

```css
.panelBody {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.section {
  border-bottom: 1px solid var(--ivory-08);
  padding-bottom: var(--space-4);
}

.section:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.sectionSummary {
  font-family: var(--font-label);
  font-size: var(--text-xs);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--color-gold);
  cursor: pointer;
  list-style: none;
  padding: var(--space-2) 0;
}

.sectionSummary::-webkit-details-marker {
  display: none;
}

.linkList {
  list-style: none;
  padding: var(--space-2) 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.link {
  color: var(--color-platinum);
  text-decoration: none;
  font-size: var(--text-sm);
}

.link:hover {
  color: var(--color-gold);
}
```

**Conserva `.gearButton` tal cual** (incluido su `border-radius: 50%`): el engranaje sigue siendo un botón circular.

- [ ] **Step 3: Verificar build y lint**

Run: `npm run build`
Expected: "✓ Compiled successfully".

Run: `npx eslint src/components/SettingsPanel.js`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/components/SettingsPanel.js src/components/SettingsPanel.module.css
git commit -m "refactor(nav): rueda como desplegable con secciones (Reclutador/Config)"
```

---

### Task 6: Montar en la barra y convertir `/dashboard` en redirect

**Files:**
- Modify: `src/components/Navigation.js`
- Modify: `src/app/dashboard/page.js` (reescritura: redirect que abre el Tablero)
- Delete: `src/app/dashboard/DashboardClient.js`
- Delete: `src/app/dashboard/dashboard.module.css`

**Interfaces:**
- Consumes: `DashboardMenu` (Task 4), `SettingsPanel` (Task 5), `getMenu` de `src/lib/api.js`.
- Produces: barra con Tablero (solo con sesión) + rueda, ambos desplegables y visibles en escritorio y móvil; `/dashboard` redirige a `/` y abre el Tablero.

- [ ] **Step 1: Importar `DashboardMenu` y `getMenu` en `Navigation.js`**

En `src/components/Navigation.js`, tras `import SettingsPanel from "./SettingsPanel";` añade:

```jsx
import DashboardMenu from "./DashboardMenu";
import { getMenu } from "../lib/api";
```

- [ ] **Step 2: Añadir estado del menú y cargarlo con la sesión**

Reemplaza el efecto de carga de sesión existente:

```jsx
  // Cargar sesión al montar / cuando cambia la ruta (post-login refresh)
  useEffect(() => {
    setUser(getCurrentUser());
  }, [pathname]);
```

por:

```jsx
  // Cargar sesión + menú por rol al montar / cuando cambia la ruta
  useEffect(() => {
    const u = getCurrentUser();
    setUser(u);
    if (u) getMenu().then(setMenu);
    else setMenu([]);
  }, [pathname]);
```

Y añade el estado junto a los demás `useState` (tras `const [user, setUser] = useState(null);`):

```jsx
  const [menu, setMenu] = useState([]);
```

- [ ] **Step 3: Quitar el enlace "Dashboard" de escritorio y montar los desplegables**

En el bloque de escritorio, **elimina** el `<Link href="/dashboard">` (el que muestra `t("dashboard")` dentro de `actionGroup`):

```jsx
                <Link
                  href="/dashboard"
                  className={`${styles.navLink} ${pathname === "/dashboard" ? styles.navLinkActive : ""}`}
                  aria-current={pathname === "/dashboard" ? "page" : undefined}
                >
                  {t("dashboard")}
                </Link>
```

Luego, en `rightCluster`, reemplaza la línea `<SettingsPanel />` por:

```jsx
        {user && <DashboardMenu menu={menu} />}
        <SettingsPanel menu={menu} />
```

- [ ] **Step 4: Quitar el enlace "Dashboard" del overlay móvil**

En el bloque móvil, **elimina** el `<Link href="/dashboard">` con `className="btn-ghost"`:

```jsx
                <Link
                  href="/dashboard"
                  className="btn-ghost"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {t("dashboard")}
                </Link>
```

(El Tablero ya es accesible desde el desplegable en `rightCluster`, visible también en móvil.)

- [ ] **Step 5: Convertir `/dashboard` en redirect que abre el Tablero**

Replace el contenido completo de `src/app/dashboard/page.js` con:

```jsx
"use client";

/**
 * /dashboard ya no es una página de contenido: el tablero vive en el
 * desplegable de la barra. Esta ruta redirige a la home y dispara el evento
 * que abre el Tablero, para no romper marcadores ni enlaces antiguos.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DashboardRedirect() {
  const router = useRouter();
  useEffect(() => {
    window.dispatchEvent(new Event("distinct:open-dashboard"));
    router.replace("/");
  }, [router]);
  return null;
}
```

- [ ] **Step 6: Borrar los archivos ya no usados**

```bash
git rm src/app/dashboard/DashboardClient.js src/app/dashboard/dashboard.module.css
```

- [ ] **Step 7: Verificar build y lint**

Run: `npm run build`
Expected: "✓ Compiled successfully" y que `/dashboard` compile como ruta.

Run: `npx eslint src/components/Navigation.js src/app/dashboard/page.js`
Expected: sin errores (ni imports sin usar como `Link` — si quedó sin uso, quítalo; `Link` sigue usándose por los `navLinks`, así que se conserva).

- [ ] **Step 8: Verificación manual**

Con `npm run dev` y una cuenta con cursos (p. ej. `admin`):
- La barra muestra "Tablero" (con sesión) y el engranaje, ambos abren desplegable.
- Tablero: lista de cursos con miniatura + nombre + barra; botón Entrenar hace SSO; Eval/Pay llevan a /coming-soon.
- Rueda: sección Reclutador (según rol) y Configuración con enlaces + Idioma + Tema funcionando.
- Ir a `/dashboard` redirige a `/` y abre el Tablero.
- En móvil (≤768px) los paneles se ven a lo ancho.

- [ ] **Step 9: Commit**

```bash
git add src/components/Navigation.js src/app/dashboard/page.js
git commit -m "feat(nav): montar Tablero+rueda en la barra; /dashboard redirige y abre el Tablero"
```

---

## Notas de implementación / desviaciones respecto al spec

- **Móvil sin “sheet” dentro del overlay:** en vez de renderizar Tablero/Config dentro del overlay a pantalla completa, ambos desplegables viven en `rightCluster` (visible en todos los tamaños) y su **panel pasa a ancho completo por CSS** en ≤768px. Mismo resultado (“a lo ancho en móvil”), menos código y sin instancias duplicadas. Se elimina la prop `variant` mencionada en el spec.
- **`NavDropdown` controlado:** el estado `open` lo posee cada padre (Tablero/Rueda), lo que permite abrir por evento (`distinct:open-dashboard` / `distinct:open-settings`) sin refs imperativas.
