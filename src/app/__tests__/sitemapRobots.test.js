import { describe, it, expect } from "vitest";

// El sitio NO tenía sitemap ni robots.txt — ninguno de los dos, en ninguna
// ruta. La ficha los pide (sección 7, FR-10) y le sirven a todo el sitio, no
// solo al centro de white papers.
import sitemap from "../sitemap";
import robots from "../robots";
import { SITE_URL } from "../../lib/config";
import { getAllCategories, getAllPapers } from "../../lib/insights";

describe("sitemap", () => {
  const entradas = sitemap();
  const urls = entradas.map((e) => e.url);

  it("incluye la portada y el índice del centro", () => {
    expect(urls).toContain(`${SITE_URL}/`);
    expect(urls).toContain(`${SITE_URL}/insights`);
  });

  it("incluye las páginas públicas que ya existían", () => {
    expect(urls).toContain(`${SITE_URL}/about`);
    expect(urls).toContain(`${SITE_URL}/courses`);
  });

  it("incluye cada paper publicado", () => {
    for (const paper of getAllPapers()) {
      expect(urls).toContain(`${SITE_URL}/insights/${paper.slug}`);
    }
  });

  it("incluye cada página de categoría", () => {
    // Sin esto Google tiene que descubrirlas por enlaces, y con una sola
    // categoría el índice ni siquiera muestra el filtro.
    for (const categoria of getAllCategories()) {
      expect(urls).toContain(`${SITE_URL}/insights/category/${categoria.slug}`);
    }
  });

  it("no lista páginas privadas ni de sesión", () => {
    // Un sitemap que invita a Google al login gasta rastreo y expone rutas.
    const prohibidas = ["/login", "/register", "/account", "/dashboard", "/settings"];
    for (const ruta of prohibidas) {
      expect(urls.some((u) => u.includes(ruta))).toBe(false);
    }
  });

  it("cada entrada lleva fecha de última modificación", () => {
    for (const entrada of entradas) {
      expect(entrada.lastModified, entrada.url).toBeTruthy();
    }
  });

  it("no repite ninguna URL", () => {
    expect(new Set(urls).size).toBe(urls.length);
  });
});

describe("robots", () => {
  const reglas = robots();

  it("apunta al sitemap con URL absoluta", () => {
    expect(reglas.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
  });

  it("deja rastrear el centro de white papers", () => {
    expect(reglas.rules.allow).toContain("/");
  });

  it("bloquea las rutas privadas y los PDF", () => {
    // El PDF se puede descargar, pero no debe competir en Google con la
    // página del paper, que es la que tiene que posicionar (sección 7).
    const bloqueadas = reglas.rules.disallow;
    expect(bloqueadas).toContain("/insights/pdf/");
    expect(bloqueadas).toContain("/dashboard/");
    expect(bloqueadas).toContain("/settings/");
    expect(bloqueadas).toContain("/account/");
  });
});
