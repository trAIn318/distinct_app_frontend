# Spec — Navbar con desplegables (Tablero + Rueda)

**Fecha:** 2026-07-01
**Repo:** `distinct_app_frontend` (solo frontend — cero cambios de backend/BD)
**Objetivo:** El dashboard deja de ocupar una página y pasa a ser un desplegable
en la barra. Los accesos del menú por rol se organizan en secciones plegables
dentro de la rueda (⚙). Petición explícita de los jefes: que el tablero no
ocupe la página principal, solo el desplegable.

---

## 1. Contexto y restricciones

- **CR1 — Cero cambios de backend/BD.** Todo lo necesario ya lo sirven endpoints
  existentes:
  - `GET /api/dashboard/courses/` → `{courses: [{id, name, image, progress, url}], moodle_linked}`
  - `GET /api/dashboard/training/` → `{loginurl}` (SSO a Moodle)
  - `GET /api/menu/` → `[{group, key, title, url, icon}]` ya agrupado por
    `menu_group` ∈ {`DASHBOARD`, `RECRUITER`, `SETTINGS`} y filtrado por rol.
- **CR2 — Design system (`distinct_app_frontend/CLAUDE.md`).** Solo tokens de
  diseño; sin `border-radius`; esquinas rectas; superficies oscuras
  (`--color-surface-dark`) con `backdrop-filter: blur`; borde `--color-platinum`;
  gold como acento moderado; i18n con `useT`/`getT`.
- **CR3 — No romper enlaces existentes.** `/dashboard`, el enlace "Dash" del menú
  y marcadores viejos deben seguir funcionando (vía redirect, no 404).
- **CR4 — Degradación elegante.** Fallo de Moodle/menú → estado vacío, nunca error
  que rompa la barra.

### Datos de menú por rol (verificado en BD, 2026-07-01)
`menu_group` reales: `DASHBOARD`, `RECRUITER`, `SETTINGS`. Ejemplos:
- Viewer (rol 3): DASHBOARD[Dash, Eval, Pay, Training] · SETTINGS[Load CV, Language]
- Admin (rol 1): + RECRUITER[Load CVs, Search Candidate] · SETTINGS[Admin, Load CV, Language, Admin Company]

---

## 2. Arquitectura de componentes (frontend)

### 2.1 `NavDropdown` (nuevo, reutilizable)
Cascarón presentacional/comportamental compartido por Tablero y Rueda.
- **Props:** `trigger` (contenido del botón), `align` (`start|end`),
  `label` (aria), `children` (contenido del panel), `onOpenChange?`.
- **Responsabilidad única:** estado abierto/cerrado, cierre con `Escape` y
  clic-fuera, `aria-expanded`/`aria-haspopup`, foco al panel al abrir, animación
  de entrada (fade + `translateY`) con override `prefers-reduced-motion`.
- **Escritorio:** panel anclado bajo el botón. **Móvil:** el mismo contenido se
  renderiza a lo ancho dentro del overlay existente (ver §4).
- No conoce nada de cursos ni de settings — solo abre/cierra y coloca el panel.

### 2.2 `DashboardMenu` (nuevo — el "Tablero")
- Trigger: botón "Tablero" en la barra (reemplaza el enlace actual a `/dashboard`).
  **Solo con sesión.**
- Contenido del panel:
  - Lista de cursos: miniatura + nombre + barra de progreso (se **mueve** el
    render actual de `DashboardClient.js`; reutiliza `resolveCourseImage`,
    `COURSE_IMAGE_FALLBACK` y los estilos `.courseThumb/.courseName/.progress*`).
  - Botón **Entrenar** (SSO): `getDashboardCourses`/`startTraining` de `lib/api.js`.
  - Accesos secundarios del grupo DASHBOARD que no son progreso: **Eval · Pay**
    → `/coming-soon`.
  - Estado vacío: mensaje i18n "aún no tienes cursos".
- **Carga perezosa:** `getDashboardCourses()` se llama la **primera vez que se
  abre** el panel (no en cada montaje de la barra). Cachea el resultado en estado.

### 2.3 `SettingsPanel` (refactor — la "Rueda")
Deja de ser slide-over lateral; pasa a `NavDropdown` anclado al engranaje.
Secciones plegables (`<details>`/acordeón accesible):
- **RECLUTADOR** — solo si el rol trae items del grupo `RECRUITER`
  (Load CVs, Search Candidate → `/coming-soon`).
- **CONFIGURACIÓN** — items del grupo `SETTINGS` del rol (Admin, Admin Company,
  Load CV → `/coming-soon`) **+ controles reales de Idioma y Tema** (lógica
  actual de `preferences`: `handleLanguage`, `handleTheme`, `SUPPORTED_LANGUAGES`).
- El item `settings/language` **no** se lista como enlace: se sustituye por el
  control de Idioma inline. El **Tema** se añade aunque no venga del menú.
- Sin sesión: la rueda muestra **solo Idioma + Tema** (sin secciones de menú).

### 2.4 `splitMenuByGroup` (nuevo — función pura, testeable)
Entrada: `items` de `/api/menu/`. Salida:
`{ dashboard: [...], recruiter: [...], settings: [...] }` (case-insensitive sobre
`group`; grupos desconocidos se ignoran de forma segura). Es la única lógica de
reparto; se testea de forma aislada.

### 2.5 `resolveMenuTarget` (se conserva/centraliza)
Mapea `item.url` → comportamiento: `train` (dashboard/trainy), `language`
(settings/language → control inline), `dash` (dashboard/dash → se omite como
enlace), y todo lo demás → `{ type: "route", href: "/coming-soon" }`. Se extrae
de `DashboardClient.js` a un módulo compartido (p. ej. `lib/menuTargets.js`) para
que Tablero y Rueda lo usen sin duplicar.

---

## 3. Integración en la barra (`Navigation.js`)
- **Escritorio (con sesión):** el enlace "Dashboard" se reemplaza por el trigger
  de `DashboardMenu`. La rueda (`SettingsPanel`) sigue a su lado, ahora desplegable.
- **Escritorio (sin sesión):** sin Tablero; la rueda muestra solo Idioma+Tema.
- El resto de la barra (logo, Home/Courses/About, Meet Aria, badge de usuario,
  Sign out) no cambia.

---

## 4. Móvil y ruta `/dashboard`
- **Móvil:** dentro del overlay a pantalla completa existente, Tablero y
  Configuración se renderizan como **secciones a lo ancho (acordeón)** — mismo
  contenido, sin mini-panel. `NavDropdown` recibe una prop `variant`
  (`"popover"` por defecto en escritorio, `"sheet"` a lo ancho en el overlay
  móvil); el llamador decide la variante según el punto de montaje.
- **`/dashboard`:** deja de ser página de contenido. `app/dashboard/page.js`
  pasa a ser un client component mínimo que hace `router.replace("/")` y dispara
  `window.dispatchEvent(new Event("distinct:open-dashboard"))`; `DashboardMenu`
  escucha ese evento (igual que `SettingsPanel` escucha `distinct:open-settings`)
  y abre su panel. Nadie aterriza en una página de dashboard; enlaces viejos no
  se rompen.

---

## 5. i18n
- Namespace `dashboard`: reutiliza `coursesTitle`, `empty`, `trainCta`,
  `trainLoading`, `trainError`; añade `sectionRecruiter`, `sectionDashboard`,
  `sectionSettings` (cabeceras de sección) según haga falta.
- Namespace `settings`: reutiliza `language`, `theme`, `dark`, `light`, `note`.
- Los títulos de items del menú usan `t(item.key)` con **fallback a `item.title`**.
- Claves nuevas se añaden a `src/i18n/messages/en.json` y `es.json`.

---

## 6. Estética y accesibilidad
- Panel: `--color-surface-dark`, borde `1px --color-platinum`, sin radios,
  `backdrop-filter: blur(12px)`; sombra solo si el fondo lo exige.
- Entrada: fade + `translateY(8px)→0`, `0.2s`, easing expo-out; barra de progreso
  con `--color-gold` sobre `--color-platinum`.
- `@media (prefers-reduced-motion)` desactiva transform/opacity.
- `aria-expanded`, `aria-haspopup`, `role="dialog"`/menú según corresponda; foco
  gestionado al abrir; cierre por `Escape` y clic-fuera; navegable con `Tab`.
- Contraste WCAG AA (texto claro sobre superficie oscura: `--color-text-inverse`).

---

## 7. Archivos afectados (solo `distinct_app_frontend`)
- **Nuevos:**
  - `src/components/NavDropdown.js` + `NavDropdown.module.css`
  - `src/components/DashboardMenu.js` + `DashboardMenu.module.css`
  - `src/lib/menuTargets.js` (`splitMenuByGroup` + `resolveMenuTarget`)
- **Refactor:**
  - `src/components/SettingsPanel.js` (+ su CSS) → desplegable con secciones
  - `src/components/Navigation.js` → montar Tablero + variante móvil
- **Cambio:**
  - `src/app/dashboard/page.js` → redirect + abrir Tablero
  - `src/app/dashboard/DashboardClient.js` → su render de cursos se mueve a
    `DashboardMenu`; queda eliminado o reducido a lo mínimo
- **i18n:** `src/i18n/messages/en.json`, `src/i18n/messages/es.json`

---

## 8. Estrategia de pruebas
- **Unitario (vitest):** `splitMenuByGroup` (reparte por grupo, ignora grupos
  desconocidos, case-insensitive) y `resolveMenuTarget` (train/language/dash/
  coming-soon).
- **Build:** `next build` verde; lint limpio en archivos tocados.
- **Manual:** con cuenta que tenga cursos (p. ej. `admin`), verificar: Tablero
  abre con progreso, Entrenar hace SSO, rueda muestra secciones por rol, Idioma/
  Tema siguen funcionando, `/dashboard` redirige y abre el Tablero, móvil OK.

---

## 9. Fuera de alcance (explícito)
- Construir las páginas reales de Eval, Pay, Load CV, Reclutador, Admin (siguen
  en `/coming-soon`).
- Cualquier cambio de backend, endpoints o esquema/datos de BD.
- Traducción de páginas legales (tema aparte, en pausa).
