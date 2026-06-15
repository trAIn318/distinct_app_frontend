# Living Elegance — Interactividad reactiva · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir interactividad reactiva (imágenes duotono→color, micro-interacciones y contadores) como componentes parametrizables, sobre el design system existente, mejorando además el rendimiento de imágenes.

**Architecture:** Defaults globales centralizados (tokens CSS + `src/lib/motion.js`) con override por props en cada componente. La lógica pura (easing, formato, offset magnético) se extrae a helpers testeables con Vitest; los efectos visuales se verifican en navegador + Lighthouse. `ReactiveImage` envuelve `next/image` y reemplaza los `<img>` crudos.

**Tech Stack:** Next.js 16 (App Router), React 19, CSS Modules + CSS custom properties, Vitest + @testing-library/react (nuevo), `next/image`, `sharp` (conversión WebP).

**Spec:** `docs/superpowers/specs/2026-06-15-living-elegance-interactivity-design.md`

---

## File Structure

**Nuevos:**
- `src/lib/motion.js` — defaults globales de animación + easings + helpers puros.
- `src/lib/__tests__/motion.test.js` — tests de helpers puros.
- `src/components/ReactiveImage.js` + `ReactiveImage.module.css` — imagen duotono parametrizable.
- `src/components/AnimatedCounter.js` + `AnimatedCounter.module.css` — contador en viewport.
- `src/components/__tests__/AnimatedCounter.test.js` — test del componente.
- `src/lib/magnetic.js` + `src/lib/__tests__/magnetic.test.js` — efecto magnético opcional.
- `vitest.config.mjs` + `vitest.setup.js` — config de tests.

**Modificados:**
- `src/styles/tokens.css` — tokens nuevos (duotono, zoom, duraciones).
- `src/styles/components/buttons.css` — micro-interacción de tracking en hover.
- `src/styles/global.css` — subrayado animado de enlaces.
- `src/components/Hero.js`, `Solutions.js`, `TeamCard.js`, `CourseCard.js`, `FeaturedCourses.js` — usar `ReactiveImage`.
- `src/components/ValuePropBar.js` (o donde vivan los stats de la Home) — usar `AnimatedCounter`.
- `package.json` — scripts de test + devDependencies.

---

## Task 0: Baseline de rendimiento + harness de tests

**Files:**
- Create: `vitest.config.mjs`, `vitest.setup.js`
- Modify: `package.json`

- [ ] **Step 1: Capturar baseline de Lighthouse (antes de cualquier cambio)**

Run:
```bash
cd distinct_app_frontend && npm run build && npm start &
npx lighthouse http://localhost:3000 --only-categories=performance,accessibility --output=json --output-path=docs/superpowers/lighthouse-baseline.json --chrome-flags="--headless"
```
Expected: genera `lighthouse-baseline.json`. Anotar el score de Performance (referencia para el final). Detener el server (`kill %1`).

- [ ] **Step 2: Instalar dependencias de test**

Run:
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @vitejs/plugin-react
```
Expected: se añaden a `devDependencies` sin errores.

- [ ] **Step 3: Crear `vitest.config.mjs`**

```js
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.js"],
  },
});
```

- [ ] **Step 4: Crear `vitest.setup.js`**

```js
import "@testing-library/jest-dom/vitest";

// IntersectionObserver no existe en jsdom — stub que dispara "visible" al observar.
class IO {
  constructor(cb) { this.cb = cb; }
  observe(el) { this.cb([{ isIntersecting: true, target: el }]); }
  unobserve() {}
  disconnect() {}
}
globalThis.IntersectionObserver = IO;

// matchMedia: por defecto reduced-motion = false.
globalThis.matchMedia = globalThis.matchMedia || ((q) => ({
  matches: false, media: q, addEventListener() {}, removeEventListener() {},
  addListener() {}, removeListener() {},
}));

// requestAnimationFrame determinista para tests de conteo.
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
```

- [ ] **Step 5: Añadir scripts de test a `package.json`**

En `"scripts"` añadir:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6: Verificar que el harness corre (sin tests aún)**

Run: `npm test`
Expected: Vitest arranca y reporta "No test files found" (exit 0 o mensaje de sin tests). El harness funciona.

- [ ] **Step 7: Commit**

```bash
git add vitest.config.mjs vitest.setup.js package.json package-lock.json docs/superpowers/lighthouse-baseline.json
git commit -m "[test] add Vitest + Testing Library harness and Lighthouse baseline"
```

---

## Task 1: Tokens + defaults globales de motion

**Files:**
- Modify: `src/styles/tokens.css`
- Create: `src/lib/motion.js`
- Test: `src/lib/__tests__/motion.test.js`

- [ ] **Step 1: Escribir el test de los helpers puros**

Create `src/lib/__tests__/motion.test.js`:
```js
import { describe, it, expect } from "vitest";
import { easings, countAt, formatNumber } from "../motion";

describe("easings.easeOutCubic", () => {
  it("starts at 0 and ends at 1", () => {
    expect(easings.easeOutCubic(0)).toBe(0);
    expect(easings.easeOutCubic(1)).toBe(1);
  });
  it("is ahead of linear at the midpoint (ease-out)", () => {
    expect(easings.easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });
});

describe("countAt", () => {
  it("returns 0 at progress 0 and target at progress 1", () => {
    expect(countAt(1000, 0, easings.easeOutCubic)).toBe(0);
    expect(countAt(1000, 1, easings.easeOutCubic)).toBe(1000);
  });
  it("returns an integer mid-way", () => {
    const v = countAt(1000, 0.5, easings.easeOutCubic);
    expect(Number.isInteger(v)).toBe(true);
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(1000);
  });
});

describe("formatNumber", () => {
  it("adds thousands separators by default", () => {
    expect(formatNumber(1248)).toBe("1,248");
  });
  it("applies prefix and suffix", () => {
    expect(formatNumber(95, { suffix: "%" })).toBe("95%");
    expect(formatNumber(5, { prefix: "+" })).toBe("+5");
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test -- motion`
Expected: FAIL — "Failed to resolve import ../motion" o "easings is not defined".

- [ ] **Step 3: Crear `src/lib/motion.js`**

```js
/**
 * Defaults globales de animación + helpers puros.
 * Cambiar un default aquí afecta a toda la app; cada componente puede
 * sobreescribir vía props. Los valores visuales viven como tokens CSS
 * (tokens.css); aquí van los que necesita el JS.
 */

export const easings = {
  easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
  easeOutExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  linear: (t) => t,
};

/** Defaults de cada efecto (override por props en los componentes). */
export const motion = {
  counter: { durationMs: 2200, easing: "easeOutCubic" },
  reactive: { trigger: "both", durationMs: 500 }, // visual real vive en CSS tokens
  magnetic: { strength: 0.3, radius: 120 },
};

/** Valor del contador para un progreso 0..1 dado, redondeado a entero. */
export function countAt(target, progress, easingFn) {
  const p = Math.min(Math.max(progress, 0), 1);
  return Math.round(easingFn(p) * target);
}

/** Formatea un número con separador de miles + prefijo/sufijo opcionales. */
export function formatNumber(value, { prefix = "", suffix = "" } = {}) {
  return `${prefix}${value.toLocaleString("en-US")}${suffix}`;
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npm test -- motion`
Expected: PASS (3 describe, todos verdes).

- [ ] **Step 5: Añadir tokens nuevos a `src/styles/tokens.css`**

Dentro del bloque `:root`, tras la sección "Translucent accents", añadir:
```css
  /* ── Living Elegance — efectos reactivos (parametrizables) ──────── */
  --duotone-tint:          var(--color-gold);   /* color del overlay duotono */
  --duotone-opacity:       0.55;                /* intensidad del tinte en reposo */
  --reactive-zoom:         1.05;                /* escala de imagen en reposo */
  --reactive-duration:     0.5s;                /* transición duotono/zoom */
  --reactive-ease:         var(--ease-luxe);    /* ya existe */
  --underline-grow:        0.35s;               /* subrayado de enlaces */
  --btn-hover-tracking:    0.22em;              /* letter-spacing en hover */
```

Y dentro del bloque `[data-theme="light"]`, ajustar el tinte para tema claro:
```css
  --duotone-tint:    var(--color-gold-muted);
  --duotone-opacity: 0.45;
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/motion.js src/lib/__tests__/motion.test.js src/styles/tokens.css
git commit -m "[motion] add global motion defaults, pure helpers (tested) and reactive tokens"
```

---

## Task 2: AnimatedCounter

**Files:**
- Create: `src/components/AnimatedCounter.js`, `src/components/AnimatedCounter.module.css`
- Test: `src/components/__tests__/AnimatedCounter.test.js`

- [ ] **Step 1: Escribir el test del componente**

Create `src/components/__tests__/AnimatedCounter.test.js`:
```js
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import AnimatedCounter from "../AnimatedCounter";

afterEach(cleanup);

describe("AnimatedCounter", () => {
  it("eventually shows the final formatted value", async () => {
    render(<AnimatedCounter value={1248} />);
    await waitFor(() => expect(screen.getByText("1,248")).toBeInTheDocument());
  });

  it("applies prefix and suffix to the final value", async () => {
    render(<AnimatedCounter value={95} suffix="%" />);
    await waitFor(() => expect(screen.getByText("95%")).toBeInTheDocument());
  });

  it("renders the final value immediately when reduced motion is preferred", async () => {
    vi.stubGlobal("matchMedia", (q) => ({
      matches: true, media: q, addEventListener() {}, removeEventListener() {},
      addListener() {}, removeListener() {},
    }));
    render(<AnimatedCounter value={500} />);
    expect(screen.getByText("500")).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test -- AnimatedCounter`
Expected: FAIL — "Failed to resolve import ../AnimatedCounter".

- [ ] **Step 3: Crear `src/components/AnimatedCounter.js`**

```js
"use client";

/**
 * AnimatedCounter — cuenta de 0 hasta `value` al entrar en viewport.
 * Parametrizable: duración, easing, prefijo/sufijo y formateador.
 * Respeta prefers-reduced-motion (pinta el valor final sin animar).
 * Tipografía monoespaciada (--font-label): los números van en mono.
 */

import { useEffect, useRef, useState } from "react";
import { easings, motion, countAt, formatNumber } from "../lib/motion";
import styles from "./AnimatedCounter.module.css";

export default function AnimatedCounter({
  value,
  durationMs = motion.counter.durationMs,
  easing = motion.counter.easing,
  prefix = "",
  suffix = "",
  className = "",
}) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduce || typeof IntersectionObserver === "undefined") {
      setDisplay(value);
      return;
    }

    const easeFn = easings[easing] || easings.easeOutCubic;

    const start = (t0) => {
      const tick = (now) => {
        const progress = (now - t0) / durationMs;
        setDisplay(countAt(value, progress, easeFn));
        if (progress < 1) rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          start(performance.now());
          io.unobserve(el);
        }
      });
    }, { threshold: 0.4 });

    io.observe(el);
    return () => {
      io.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, durationMs, easing]);

  return (
    <span ref={ref} className={`${styles.counter} ${className}`}>
      {formatNumber(display, { prefix, suffix })}
    </span>
  );
}
```

- [ ] **Step 4: Crear `src/components/AnimatedCounter.module.css`**

```css
.counter {
  font-family: var(--font-label);
  font-variant-numeric: tabular-nums; /* ancho fijo: no "salta" al contar */
  letter-spacing: 0.02em;
}
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `npm test -- AnimatedCounter`
Expected: PASS (3 tests verdes).

- [ ] **Step 6: Commit**

```bash
git add src/components/AnimatedCounter.js src/components/AnimatedCounter.module.css src/components/__tests__/AnimatedCounter.test.js
git commit -m "[counter] add parametrizable AnimatedCounter with reduced-motion fallback"
```

---

## Task 3: ReactiveImage

**Files:**
- Create: `src/components/ReactiveImage.js`, `src/components/ReactiveImage.module.css`
- Test: `src/components/__tests__/ReactiveImage.test.js`

- [ ] **Step 1: Escribir el test del componente**

Create `src/components/__tests__/ReactiveImage.test.js`:
```js
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import ReactiveImage from "../ReactiveImage";

// next/image → <img> simple en test
vi.mock("next/image", () => ({
  default: (props) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

afterEach(cleanup);

describe("ReactiveImage", () => {
  it("renders an image with the given alt and src", () => {
    render(<ReactiveImage src="/img/courses/frontdesk.jpeg" alt="Front Desk" ratio="4:3" />);
    const img = screen.getByAltText("Front Desk");
    expect(img).toBeInTheDocument();
    expect(img.getAttribute("src")).toContain("frontdesk");
  });

  it("exposes effect=none to disable the duotone (data attribute)", () => {
    const { container } = render(
      <ReactiveImage src="/x.jpg" alt="x" effect="none" />
    );
    const figure = container.querySelector("figure");
    expect(figure.getAttribute("data-effect")).toBe("none");
  });

  it("sets a CSS variable for the tint opacity override", () => {
    const { container } = render(
      <ReactiveImage src="/x.jpg" alt="x" tintOpacity={0.2} />
    );
    const figure = container.querySelector("figure");
    expect(figure.getAttribute("style")).toContain("0.2");
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test -- ReactiveImage`
Expected: FAIL — "Failed to resolve import ../ReactiveImage".

- [ ] **Step 3: Crear `src/components/ReactiveImage.js`**

```js
"use client";

/**
 * ReactiveImage — next/image con efecto duotono dorado → color + zoom sutil.
 * Resuelve estética Y rendimiento (AVIF/WebP, lazy-load, width/height → sin CLS).
 *
 * Todo parametrizable por props; los defaults visuales salen de tokens.css y
 * solo se sobreescriben cuando se pasa la prop (vía CSS custom properties inline).
 *
 *   trigger="hover"  → se revela al pasar el cursor (desktop)
 *   trigger="inview" → se revela al entrar en viewport (móvil/táctil)
 *   trigger="both"   → ambos (default)
 *
 * Respeta prefers-reduced-motion: imagen a color fija.
 */

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { motion } from "../lib/motion";
import styles from "./ReactiveImage.module.css";

const RATIO_DIMS = {
  "16:9": { width: 1600, height: 900 },
  "4:3": { width: 1200, height: 900 },
  "1:1": { width: 1000, height: 1000 },
};

export default function ReactiveImage({
  src,
  alt,
  ratio = "4:3",
  priority = false,
  effect = "duotone",
  tint,                 // override de --duotone-tint
  tintOpacity,          // override de --duotone-opacity
  zoom,                 // override de --reactive-zoom
  duration,             // override de --reactive-duration
  trigger = motion.reactive.trigger,
  sizes = "(max-width: 768px) 100vw, 33vw",
  className = "",
}) {
  const { width, height } = RATIO_DIMS[ratio] || RATIO_DIMS["4:3"];
  const [inView, setInView] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (effect === "none" || trigger === "hover") return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { setInView(true); io.unobserve(el); }
      });
    }, { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, [effect, trigger]);

  // Solo declaramos las custom properties que el usuario sobreescribe.
  const styleVars = {};
  if (tint) styleVars["--duotone-tint"] = tint;
  if (tintOpacity != null) styleVars["--duotone-opacity"] = String(tintOpacity);
  if (zoom != null) styleVars["--reactive-zoom"] = String(zoom);
  if (duration) styleVars["--reactive-duration"] = duration;

  return (
    <figure
      ref={ref}
      className={`${styles.frame} ${className}`}
      data-effect={effect}
      data-trigger={trigger}
      data-inview={inView ? "true" : "false"}
      style={styleVars}
    >
      <Image
        className={styles.img}
        src={src}
        alt={alt}
        width={width}
        height={height}
        sizes={sizes}
        priority={priority}
      />
    </figure>
  );
}
```

- [ ] **Step 4: Crear `src/components/ReactiveImage.module.css`**

```css
.frame {
  position: relative;
  overflow: hidden;
  margin: 0;
  line-height: 0;
}

.img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transform: scale(var(--reactive-zoom));
  filter: grayscale(1) contrast(1.03);
  transition:
    transform var(--reactive-duration) var(--reactive-ease),
    filter var(--reactive-duration) var(--reactive-ease);
}

/* Overlay de tinte dorado (duotono) */
.frame[data-effect="duotone"]::after {
  content: "";
  position: absolute;
  inset: 0;
  background: var(--duotone-tint);
  mix-blend-mode: multiply;
  opacity: var(--duotone-opacity);
  transition: opacity var(--reactive-duration) var(--reactive-ease);
  pointer-events: none;
}

/* Estado revelado: por hover (desktop) o por inview (móvil) */
.frame[data-effect="duotone"][data-trigger="hover"]:hover .img,
.frame[data-effect="duotone"][data-trigger="both"]:hover .img,
.frame[data-effect="duotone"][data-trigger="inview"][data-inview="true"] .img,
.frame[data-effect="duotone"][data-trigger="both"][data-inview="true"] .img {
  filter: grayscale(0) contrast(1);
  transform: scale(1);
}

.frame[data-effect="duotone"][data-trigger="hover"]:hover::after,
.frame[data-effect="duotone"][data-trigger="both"]:hover::after,
.frame[data-effect="duotone"][data-trigger="inview"][data-inview="true"]::after,
.frame[data-effect="duotone"][data-trigger="both"][data-inview="true"]::after {
  opacity: 0;
}

/* effect="none": imagen plana, sin filtro ni overlay */
.frame[data-effect="none"] .img {
  filter: none;
  transform: none;
  transition: none;
}

@media (prefers-reduced-motion: reduce) {
  .img { filter: none; transform: none; transition: none; }
  .frame[data-effect="duotone"]::after { opacity: 0; }
}
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `npm test -- ReactiveImage`
Expected: PASS (3 tests verdes).

- [ ] **Step 6: Commit**

```bash
git add src/components/ReactiveImage.js src/components/ReactiveImage.module.css src/components/__tests__/ReactiveImage.test.js
git commit -m "[image] add parametrizable ReactiveImage (next/image + duotone) with reduced-motion fallback"
```

---

## Task 4: Migrar imágenes a ReactiveImage

**Files:**
- Modify: `src/components/CourseCard.js`, `src/components/FeaturedCourses.js`, `src/components/Solutions.js`, `src/components/TeamCard.js`, `src/components/Hero.js`

> Nota: leer cada archivo antes de editar. Reemplazar `<img>` crudos y los `next/image`
> existentes por `ReactiveImage`, conservando `alt`, layout y clases del contenedor.
> Mantener `ratio` según el contexto del CLAUDE.md: cards 4:3, hero/wide 16:9, equipo 1:1.

- [ ] **Step 1: Migrar `CourseCard.js`**

Reemplazar el `<Image .../>` de la tarjeta por:
```jsx
<ReactiveImage
  src={imageSrc}
  alt={title}
  ratio="4:3"
  trigger="both"
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
/>
```
Añadir el import: `import ReactiveImage from "./ReactiveImage";` y quitar el de `next/image` si ya no se usa. Usar el nombre de variable de src real del archivo (p.ej. `imageSrc`/`course.image`).

- [ ] **Step 2: Migrar `Solutions.js`, `TeamCard.js`, `Hero.js`, `FeaturedCourses.js`**

En cada uno: sustituir `<img src=... alt=... />` (o `<Image>`) por `<ReactiveImage>` con el `ratio` adecuado (`1:1` en `TeamCard`, `16:9` en imágenes hero/wide, `4:3` en el resto). En el Hero, si la imagen es la principal visible al cargar, pasar `priority`. Añadir el import de `ReactiveImage` y eliminar imports de `next/image`/`<img>` que queden sin uso.

- [ ] **Step 3: Verificar build y lint**

Run: `npm run build`
Expected: build OK, sin errores de imágenes sin `width/height` ni imports sin usar.

- [ ] **Step 4: Verificación visual en navegador**

Run: `npm start` y abrir `http://localhost:3000` y `/courses` y `/about`.
Expected: imágenes en duotono dorado que pasan a color en hover (desktop) y al entrar en viewport (reducir ventana / móvil). Sin saltos de layout (CLS). Detener server.

- [ ] **Step 5: Commit**

```bash
git add src/components/CourseCard.js src/components/FeaturedCourses.js src/components/Solutions.js src/components/TeamCard.js src/components/Hero.js
git commit -m "[image] migrate raw <img>/Image usages to ReactiveImage across marketing pages"
```

---

## Task 5: Convertir PNG pesados a WebP

**Files:**
- Modify: imágenes en `public/img/*.png` (y referencias en componentes si cambia la extensión)
- Create: `scripts/to-webp.mjs`

- [ ] **Step 1: Crear el script de conversión**

Create `scripts/to-webp.mjs`:
```js
// Convierte los PNG pesados de public/img a .webp (calidad 82) junto al original.
// No borra los PNG: permite revertir referencias si hiciera falta.
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const DIR = "public/img";
const LIMIT_BYTES = 300 * 1024; // solo los > 300 KB

async function run() {
  const files = readdirSync(DIR).filter((f) => f.endsWith(".png"));
  for (const f of files) {
    const src = join(DIR, f);
    if (statSync(src).size < LIMIT_BYTES) continue;
    const out = src.replace(/\.png$/, ".webp");
    await sharp(src).webp({ quality: 82 }).toFile(out);
    console.log(`✓ ${f} → ${f.replace(/\.png$/, ".webp")}`);
  }
}
run();
```

- [ ] **Step 2: Instalar sharp y ejecutar**

Run:
```bash
npm install -D sharp
node scripts/to-webp.mjs
```
Expected: imprime una línea `✓` por cada PNG > 300 KB convertido. Verificar que los `.webp` son mucho menores (Run: `ls -lS public/img/*.webp | head`).

- [ ] **Step 3: Apuntar las referencias a .webp**

En los componentes que importan esas imágenes (las migradas en Task 4 y cualquier `import x from ".../*.png"`), cambiar la extensión `.png` → `.webp`. Buscar referencias:
Run: `grep -rn "\.png" src/`
Expected: ajustar solo las que correspondan a imágenes convertidas. `next/image` servirá AVIF/WebP igualmente, pero partir de un origen ligero reduce el peso base.

- [ ] **Step 4: Verificar build**

Run: `npm run build`
Expected: build OK, sin 404 de imágenes.

- [ ] **Step 5: Commit**

```bash
git add scripts/to-webp.mjs package.json package-lock.json public/img/*.webp src/
git commit -m "[perf] convert heavy PNG assets to WebP and repoint references"
```

---

## Task 6: Micro-interacciones (botones + enlaces)

**Files:**
- Modify: `src/styles/components/buttons.css`, `src/styles/global.css`

- [ ] **Step 1: Tracking en hover de botones**

En `src/styles/components/buttons.css`, en la regla `:hover` de `.btn-primary`, `.btn-ghost` y `.btn-white` (o el selector común), añadir transición y apertura de letras:
```css
/* añadir a la transición existente de cada botón */
transition: background 0.2s, color 0.2s, border-color 0.2s, letter-spacing 0.2s var(--ease-smooth);
```
Y en el `:hover` correspondiente:
```css
letter-spacing: var(--btn-hover-tracking);
```

- [ ] **Step 2: Subrayado animado de enlaces de navegación/footer**

En `src/styles/global.css`, añadir una utilidad reutilizable:
```css
/* ── Enlace con subrayado dorado que crece desde la izquierda ─────── */
.link-underline {
  position: relative;
  display: inline-block;
}
.link-underline::after {
  content: "";
  position: absolute;
  left: 0;
  bottom: -2px;
  height: 1px;
  width: 0;
  background: var(--color-gold);
  transition: width var(--underline-grow) var(--ease-luxe);
}
.link-underline:hover::after,
.link-underline:focus-visible::after {
  width: 100%;
}
@media (prefers-reduced-motion: reduce) {
  .link-underline::after { transition: none; }
}
```

- [ ] **Step 3: Aplicar `.link-underline` a enlaces de Footer y nav secundarios**

En `src/components/Footer.js` añadir `className="link-underline"` a los enlaces de texto. (La nav principal ya tiene su estado activo dorado; aplicar solo donde sume y no choque con el subrayado activo existente.)

- [ ] **Step 4: Verificación visual**

Run: `npm start` → hover sobre botones (las letras se abren levemente) y enlaces de footer (subrayado dorado crece). Detener server.

- [ ] **Step 5: Commit**

```bash
git add src/styles/components/buttons.css src/styles/global.css src/components/Footer.js
git commit -m "[micro] add hover letter-tracking on buttons and animated gold underline on links"
```

---

## Task 7: Botón magnético (opcional, off por defecto)

**Files:**
- Create: `src/lib/magnetic.js`, `src/lib/__tests__/magnetic.test.js`

- [ ] **Step 1: Escribir el test del helper puro**

Create `src/lib/__tests__/magnetic.test.js`:
```js
import { describe, it, expect } from "vitest";
import { magneticOffset } from "../magnetic";

const rect = { left: 100, top: 100, width: 100, height: 100 }; // centro en (150,150)

describe("magneticOffset", () => {
  it("returns zero offset when pointer is at the center", () => {
    const { x, y } = magneticOffset(150, 150, rect, 0.3);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(0);
  });
  it("pulls toward the pointer scaled by strength", () => {
    const { x } = magneticOffset(200, 150, rect, 0.3); // 50px a la derecha del centro
    expect(x).toBeCloseTo(15); // 50 * 0.3
  });
  it("scales with strength = 0 to no movement", () => {
    const { x, y } = magneticOffset(200, 200, rect, 0);
    expect(x).toBe(0);
    expect(y).toBe(0);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test -- magnetic`
Expected: FAIL — "Failed to resolve import ../magnetic".

- [ ] **Step 3: Crear `src/lib/magnetic.js`**

```js
/**
 * Efecto magnético opcional para CTAs. Off por defecto: se activa montando
 * attachMagnetic() sobre un elemento. Parametrizable por strength.
 * Usa named handlers (CLAUDE.md §5.4). Respeta reduced-motion (no monta).
 */

import { motion } from "./motion";

/** Offset puro (px) a aplicar al elemento dado el puntero y su rect. */
export function magneticOffset(pointerX, pointerY, rect, strength) {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  return { x: (pointerX - cx) * strength, y: (pointerY - cy) * strength };
}

/**
 * Activa el efecto sobre un elemento. Devuelve una función de limpieza.
 * @param {HTMLElement} el
 * @param {{strength?:number}} [opts]
 */
export function attachMagnetic(el, { strength = motion.magnetic.strength } = {}) {
  if (!el) return () => {};
  if (typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return () => {};
  }

  function onMove(e) {
    const rect = el.getBoundingClientRect();
    const { x, y } = magneticOffset(e.clientX, e.clientY, rect, strength);
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  }
  function onLeave() {
    el.style.transform = "translate(0, 0)";
  }

  el.addEventListener("mousemove", onMove);
  el.addEventListener("mouseleave", onLeave);
  return () => {
    el.removeEventListener("mousemove", onMove);
    el.removeEventListener("mouseleave", onLeave);
  };
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npm test -- magnetic`
Expected: PASS (3 tests verdes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/magnetic.js src/lib/__tests__/magnetic.test.js
git commit -m "[micro] add opt-in magnetic helper (pure offset + attach) with reduced-motion guard"
```

> El cableado del efecto a un CTA concreto queda fuera de alcance hasta que se decida
> activarlo; el helper está listo y testeado para ese momento.

---

## Task 8: Cablear AnimatedCounter en los stats de la Home

**Files:**
- Modify: el componente de stats de la Home (`ValuePropBar.js` o donde se muestren total usuarios/cursos)
- Verificar: `src/lib/api.js` ya expone `getCourses`; añadir/confirmar fuente del total de usuarios.

- [ ] **Step 1: Localizar dónde se muestran los números de la Home**

Run: `grep -rn "usuarios\|users\|total\|cursos\|courses" src/components/ValuePropBar.js src/app/page.js`
Expected: identificar el JSX donde hoy se pinta el número (o dónde debería ir según RF-01 del doc).

- [ ] **Step 2: Sustituir el número estático por AnimatedCounter**

Importar `import AnimatedCounter from "./AnimatedCounter";` y reemplazar el valor:
```jsx
<AnimatedCounter value={totalCourses} suffix="+" />
```
Donde `totalCourses` proviene de los datos ya fetchados (p.ej. `getCourses()` count) en el server component padre, pasado por props. Si el stat es de usuarios y no hay endpoint, usar el dato disponible y dejar el de usuarios para cuando exista (no inventar el número).

- [ ] **Step 3: Verificar build + test**

Run: `npm run build && npm test`
Expected: build OK, todos los tests verdes.

- [ ] **Step 4: Verificación visual**

Run: `npm start` → al hacer scroll hasta los stats, los números cuentan hacia arriba una vez. Detener server.

- [ ] **Step 5: Commit**

```bash
git add src/components/ValuePropBar.js src/app/page.js
git commit -m "[counter] wire AnimatedCounter into Home stats with real data"
```

---

## Task 9: Verificación final (rendimiento, a11y, responsive)

**Files:** ninguno (verificación)

- [ ] **Step 1: Lighthouse después de los cambios**

Run:
```bash
npm run build && npm start &
npx lighthouse http://localhost:3000 --only-categories=performance,accessibility --output=json --output-path=docs/superpowers/lighthouse-after.json --chrome-flags="--headless"
kill %1
```
Expected: comparar `performance` con `lighthouse-baseline.json`. No debe bajar; idealmente sube (objetivo CLAUDE.md ≥ 90).

- [ ] **Step 2: Verificar reduced-motion**

En DevTools → Rendering → "Emulate prefers-reduced-motion: reduce". Recargar Home y /courses.
Expected: imágenes a color fijas, contadores muestran valor final, sin transiciones de hover animadas.

- [ ] **Step 3: Verificar responsive**

Probar a 375px, 768px, 1280px, 1440px.
Expected: en táctil (≤768px) las imágenes se revelan al entrar en viewport (sin depender de hover); sin overflow ni CLS.

- [ ] **Step 4: Consola limpia + navegación por teclado**

Expected: sin errores/warnings en consola; Tab recorre CTAs y enlaces; el subrayado dorado aparece también en `:focus-visible`.

- [ ] **Step 5: Commit del informe**

```bash
git add docs/superpowers/lighthouse-after.json
git commit -m "[verify] capture post-change Lighthouse report"
```

---

## Self-Review (cobertura del spec)

- §3 Parametrización → Task 1 (motion.js + tokens), props en Tasks 2/3/7. ✅
- §4.1 ReactiveImage → Task 3 + Task 4 (migración). ✅
- §4.2 Micro-interacciones → Task 6 + Task 7 (magnético opcional). ✅
- §4.3 AnimatedCounter → Task 2 + Task 8 (cableado). ✅
- §5 Aplicación por página → Task 4 (marketing), Task 8 (Home). Login/Privacy reciben las micro-interacciones globales de Task 6. ✅
- §6 Rendimiento → Task 0 (baseline), Task 5 (WebP), Task 9 (medición). ✅
- §9 Criterios de aceptación → Task 9. ✅

Sin placeholders. Nombres consistentes (`countAt`, `formatNumber`, `magneticOffset`, `attachMagnetic`, `ReactiveImage`, `AnimatedCounter`) entre tasks.
