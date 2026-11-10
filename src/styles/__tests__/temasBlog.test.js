/**
 * El blog tiene que leerse en los DOS temas.
 *
 * Esta prueba no mira nombres de tokens: resuelve los valores reales de
 * tokens.css para el tema oscuro y para el claro, saca de las hojas de estilo
 * del blog qué token usa cada superficie y cada texto, y calcula el contraste
 * WCAG de cada par en los dos temas.
 *
 * Existe porque el bug real no se veía leyendo el CSS: la tarjeta usaba
 * `--color-surface-light` (que NO cambia con el tema) y el título heredaba el
 * color de la página (que SÍ cambia). En tema claro quedaba casi blanco sobre
 * casi blanco: 1.08:1, invisible.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const raiz = process.cwd();
const leer = (p) => fs.readFileSync(path.join(raiz, p), "utf8");
const sinComentarios = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");

/** Los valores de tokens.css, resueltos, para cada tema. */
function temas() {
  const css = sinComentarios(leer("src/styles/tokens.css"));
  const corte = css.search(/^\[data-theme="light"\]\s*\{/m);
  expect(corte).toBeGreaterThan(-1);

  const declaraciones = (trozo) => {
    const mapa = {};
    for (const m of trozo.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      mapa[m[1]] = m[2].trim();
    }
    return mapa;
  };
  const oscuro = declaraciones(css.slice(0, corte));
  const claro = { ...oscuro, ...declaraciones(css.slice(corte)) };
  // Si el corte falla, los mapas salen vacíos y la prueba pasaría en falso.
  expect(oscuro["--color-text-primary"]).toBeTruthy();
  return { oscuro, claro };
}

function resolver(tokens, valor, nivel = 0) {
  const v = String(valor).trim();
  const m = /^var\((--[\w-]+)\)$/.exec(v);
  if (m && nivel < 10) return resolver(tokens, tokens[m[1]] ?? "", nivel + 1);
  return v;
}

function rgb(hex) {
  let v = hex.trim().replace(/^#/, "");
  if (v.length === 3) v = [...v].map((c) => c + c).join("");
  expect(v).toMatch(/^[0-9A-Fa-f]{6}$/);
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16));
}

function luminancia([r, g, b]) {
  const f = (x) => {
    const s = x / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contraste(tokens, fondoTok, textoTok) {
  const a = luminancia(rgb(resolver(tokens, fondoTok)));
  const b = luminancia(rgb(resolver(tokens, textoTok)));
  const [alto, bajo] = a > b ? [a, b] : [b, a];
  return (alto + 0.05) / (bajo + 0.05);
}

/** El token declarado para `propiedad` dentro de `selector`, tal cual.
 *
 * Busca el selector como CABEZA DE REGLA, no como texto: `.page` no debe
 * encontrarse dentro de `.pageHeader`, ni `body` dentro de `--font-body`. */
function declarado(css, selector, propiedad) {
  for (const trozo of sinComentarios(css).split("}")) {
    const llave = trozo.indexOf("{");
    if (llave === -1) continue;
    if (trozo.slice(0, llave).trim() !== selector) continue;

    for (const declaracion of trozo.slice(llave + 1).split(";")) {
      const dosPuntos = declaracion.indexOf(":");
      if (dosPuntos === -1) continue;
      if (declaracion.slice(0, dosPuntos).trim() !== propiedad) continue;
      return declaracion.slice(dosPuntos + 1).trim();
    }
  }
  throw new Error(`no encontré ${selector} { ${propiedad}: ... }`);
}

const PAGINAS = [
  "src/app/insights/page.module.css",
  "src/app/insights/[slug]/page.module.css",
  "src/app/insights/category/[slug]/page.module.css",
];

describe("el blog se lee en los dos temas", () => {
  const { oscuro, claro } = temas();

  it.each(PAGINAS)("%s: el texto se lee sobre el fondo de la página", (ruta) => {
    const css = leer(ruta);
    const fondo = declarado(css, ".page", "background");
    const texto = declarado(css, ".page", "color");

    expect(contraste(oscuro, fondo, texto)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(claro, fondo, texto)).toBeGreaterThanOrEqual(4.5);
  });

  it("el título del paper se lee sobre la tarjeta (hereda el color de la página)", () => {
    const tarjeta = declarado(leer("src/components/PaperCard.module.css"), ".card", "background");
    const heredado = declarado(leer("src/app/insights/page.module.css"), ".page", "color");

    // Este es el par que estaba en 1.08:1 en tema claro.
    expect(contraste(oscuro, tarjeta, heredado)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(claro, tarjeta, heredado)).toBeGreaterThanOrEqual(4.5);
  });

  it("el acento y el texto secundario de la tarjeta se distinguen en los dos temas", () => {
    const css = leer("src/components/PaperCard.module.css");
    const tarjeta = declarado(css, ".card", "background");
    const acento = declarado(css, ".cardCategory", "color");
    const secundario = declarado(css, ".cardMeta", "color");

    // Umbral 3.0 y no 4.5 a proposito: el par "superficie oscura + texto
    // secundario" es la convencion de TODO el sitio (login, cuenta, paneles) y
    // da 3.72 en tema oscuro. Subirlo es una decision de diseño del sitio
    // entero, no del blog. Lo que esta prueba impide es que desaparezca.
    for (const tema of [oscuro, claro]) {
      expect(contraste(tema, tarjeta, acento)).toBeGreaterThanOrEqual(3);
      expect(contraste(tema, tarjeta, secundario)).toBeGreaterThanOrEqual(3);
    }
  });

  it("el blog usa el mismo fondo que el resto del sitio", () => {
    const body = declarado(leer("src/styles/global.css"), "body", "background-color");
    for (const ruta of PAGINAS) {
      expect(declarado(leer(ruta), ".page", "background")).toBe(body);
    }
  });
});
