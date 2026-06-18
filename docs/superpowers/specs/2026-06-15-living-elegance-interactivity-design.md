# Living Elegance — Interactividad reactiva

> **Fecha:** 2026-06-15 · **Proyecto:** distinct_app_frontend (Next.js 16 / React 19)
> **Estado:** Diseño aprobado — pendiente de plan de implementación

## 1. Objetivo

Elevar la interactividad y la sensación de calidad del frontend **sin** rediseñar su
estética ni romper el design system existente (`CLAUDE.md`: paleta obsidian/ivory/gold,
golden ratio, restraint). La meta es "vida reactiva" — la página responde con elegancia,
no se llena de movimiento.

Se añaden tres familias de efecto, todas como **piezas reutilizables y parametrizables**:

- **D · Imágenes reactivas** — duotono dorado → color + zoom sutil, sobre `next/image`.
- **A · Micro-interacciones** — refinamiento de botones, enlaces y cards existentes.
- **C · Datos vivos** — contadores que cuentan hacia arriba al entrar en viewport.

Restricción explícita del usuario: **todo lo necesario debe ser parametrizable.** Cada
efecto se configura por props (instancia) y por defaults centralizados (global), sin
editar el cuerpo del componente.

## 2. Principios de diseño (heredados de CLAUDE.md)

- **Solo tokens.** Ningún valor mágico: colores, espaciados, duraciones y easings salen
  de `tokens.css`. Los nuevos parámetros que necesiten default global se añaden como
  tokens nuevos, no como literales.
- **Reduced-motion siempre.** Cada efecto tiene su rama `@media (prefers-reduced-motion: reduce)`
  que muestra el estado final (imagen a color, valor final del contador) sin transición.
- **Mobile-first.** El duotono se disuelve en `hover` (desktop) **y** al entrar en viewport
  (móvil/táctil, donde no hay hover).
- **Progressive enhancement.** El contenido es funcional y visible sin JS; el efecto realza.
- **Restraint.** Si quitar un efecto no duele, no va. Generoso en marketing, mínimo en
  páginas funcionales.

## 3. Parametrización (requisito transversal)

Dos niveles, para que nada quede hardcodeado:

1. **Defaults globales** en `src/styles/tokens.css` + un módulo `src/lib/motion.js`
   (objeto JS con los defaults de animación: duraciones, easings, intensidades). Cambiar
   un default ahí afecta a toda la app.
2. **Override por instancia** vía props en cada componente. Toda prop tiene default tomado
   del nivel global; pasar la prop lo sobreescribe solo para esa instancia.

Tokens nuevos previstos (valores a afinar en implementación, derivados de los existentes):

```css
--duotone-tint:       var(--color-gold);   /* color del overlay duotono */
--duotone-opacity:    0.55;                 /* intensidad del tinte en reposo */
--reactive-zoom:      1.05;                 /* escala de la imagen en reposo */
--reactive-duration:  var(--duration-base); /* ya existe: 0.5s */
--counter-duration:   2.2s;                 /* duración del conteo */
```

## 4. Componentes

### 4.1 `ReactiveImage` (`src/components/ReactiveImage.js` + `.module.css`)

Envuelve `next/image`. Resuelve estética **y** rendimiento (AVIF/WebP, lazy-load,
`width`/`height` → elimina CLS; reemplaza los `<img>` crudos de `Hero`, `Solutions`,
`TeamCard` y los PNG de ~1.5 MB).

**Props (todas parametrizables, con default global):**

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `src` | string | — | requerido |
| `alt` | string | — | requerido (a11y) |
| `ratio` | `"16:9" \| "4:3" \| "1:1"` | `"4:3"` | aspect ratio (los de CLAUDE.md) |
| `priority` | bool | `false` | `true` para el hero (sin lazy-load) |
| `effect` | `"duotone" \| "none"` | `"duotone"` | permite desactivar el efecto por instancia |
| `tint` | string (color) | `--duotone-tint` | color del overlay |
| `tintOpacity` | number | `--duotone-opacity` | intensidad en reposo |
| `zoom` | number | `--reactive-zoom` | escala en reposo (1 = sin zoom) |
| `duration` | string | `--reactive-duration` | duración de la transición |
| `trigger` | `"hover" \| "inview" \| "both"` | `"both"` | cómo se "despierta" |
| `sizes` | string | sensato por `ratio` | pasa a `next/image` para responsive |

**Comportamiento:** reposo = `grayscale(1)` + overlay `tint`/`tintOpacity` + `scale(zoom)`.
Activo = color pleno, overlay a 0, `scale(1)`. `trigger="inview"` usa IntersectionObserver
(mismo patrón que `Reveal.js`). `reduced-motion` → estado activo fijo.

### 4.2 Micro-interacciones (CSS, sin componentes nuevos)

Extiende `src/styles/components/buttons.css`, `global.css` y los tokens. No crea archivos
de lógica salvo el botón magnético opcional.

- **Botones:** `letter-spacing` se abre levemente en hover (el fill dorado ya existe).
- **Enlaces (nav/footer):** subrayado dorado que crece desde la izquierda (`::after`,
  `width 0 → 100%`).
- **Cards:** unifica el `translateY(-4px)` existente con `ReactiveImage`.
- **Botón magnético (opcional, off por defecto):** `src/lib/magnetic.js`, función con
  named handlers (CLAUDE.md §5.4), parametrizable por `strength`. Se activa con una clase
  o prop; respeta `reduced-motion` (no se monta).

Parámetros expuestos como tokens: `--underline-grow-duration`, `--btn-hover-tracking`,
`--magnetic-strength`.

### 4.3 `AnimatedCounter` (`src/components/AnimatedCounter.js`)

Cuenta de 0 → `value` al entrar en viewport (IntersectionObserver).

**Props parametrizables:**

| Prop | Default | Descripción |
|---|---|---|
| `value` | — | número final (requerido) |
| `duration` | `--counter-duration` | duración del conteo |
| `easing` | easeOutCubic | curva del conteo |
| `format` | `toLocaleString` | formateador (ej. miles, sufijo "+") |
| `prefix` / `suffix` | `""` | texto antes/después |

Tipografía `--font-label` (mono). `reduced-motion` → pinta `value` final sin animar.
Se alimenta de los datos reales de la API (total usuarios/cursos) en la Home.

## 5. Aplicación por página

| Página | ReactiveImage | Micro-interacc. | AnimatedCounter |
|---|:---:|:---:|:---:|
| Home `/` | ✅ FeaturedCourses, Solutions | ✅ | ✅ stats reales |
| Courses `/courses` | ✅ CourseCard | ✅ | — |
| Course detail `/courses/[id]` | ✅ | ✅ | — |
| About `/about` | ✅ TeamCard | ✅ | opcional |
| Login / Register | ❌ | ✅ sutil | ❌ |
| Privacy | ❌ | ✅ enlaces | ❌ |

Razón: marketing recibe el tratamiento completo; las páginas funcionales solo
micro-interacciones, para no añadir fricción ni distracción.

## 6. Rendimiento

- `ReactiveImage` reemplaza `<img>` crudos → `next/image` da AVIF/WebP, lazy-load y
  dimensiones (elimina CLS).
- Conversión de los PNG fotográficos pesados (`public/img/*.png`, ~1.5 MB c/u) a WebP.
- Objetivo Lighthouse de CLAUDE.md (Perf ≥ 90, A11y ≥ 95). Se mide **antes/después**.

## 7. Orden de implementación

1. Tokens + `src/lib/motion.js` (defaults globales).
2. `ReactiveImage` + migración de imágenes (mayor impacto: estética + rendimiento).
3. Conversión PNG → WebP.
4. Micro-interacciones (buttons.css + enlaces; magnético opcional al final).
5. `AnimatedCounter` en la Home con datos reales.
6. Lighthouse antes/después + verificación de `reduced-motion` y responsive (375/768/1280/1440).

## 8. Fuera de alcance (YAGNI)

- Scroll cinemático / parallax adicional (ya hay `GoldenThread` + `ScrollRail`; añadir más
  recargaría y empeoraría el rendimiento).
- Rediseño visual o cambios de paleta/tipografía.
- Cambios en el backend Django.

## 9. Criterios de aceptación

- Cada efecto se configura por prop y por default global; ningún literal hardcodeado.
- Todos los efectos tienen fallback `prefers-reduced-motion`.
- Las imágenes migradas usan `next/image` con `width`/`height` y formato moderno.
- Lighthouse Performance no baja respecto al baseline (idealmente sube).
- Sin errores ni warnings en consola; navegación por teclado intacta.
