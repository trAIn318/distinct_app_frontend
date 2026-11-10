import { describe, it, expect } from "vitest";

// Feed RSS del centro (/insights/feed.xml, sección 7 de la ficha) y las
// categorías (US-8). Se construye como función pura para poder probarla sin
// levantar el servidor.
import { buildInsightsFeed } from "../insightsFeed";
import { categorySlug, getAllCategories, getPapersByCategory } from "../insights";
import { SITE_URL } from "../config";

const PAPERS = [
  {
    slug: "ai-automation-in-hospitality",
    title: "Where We Automate, and Why",
    metaDescription: "Donde pertenece la automatizacion.",
    category: "Thought Leadership",
    publishDate: "2026-11-07",
  },
  {
    slug: "otro-paper",
    title: "Otro paper & sus <comillas>",
    metaDescription: 'Con "comillas" y & ampersand.',
    category: "Workforce Data",
    publishDate: "2026-05-01",
  },
];

describe("buildInsightsFeed", () => {
  const xml = buildInsightsFeed(PAPERS);

  it("es un RSS 2.0 bien formado", () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<rss version="2.0"');
    expect(xml.trimEnd().endsWith("</rss>")).toBe(true);
  });

  it("incluye un item por paper, con enlace absoluto", () => {
    expect(xml.match(/<item>/g)).toHaveLength(2);
    expect(xml).toContain(`${SITE_URL}/insights/ai-automation-in-hospitality`);
  });

  it("escapa los caracteres que romperían el XML", () => {
    // Un & o un < sin escapar deja el feed ilegible para cualquier lector.
    expect(xml).toContain("Otro paper &amp; sus &lt;comillas&gt;");
    expect(xml).not.toContain("<comillas>");
  });

  it("usa fechas en formato RFC 822, que es lo que pide RSS", () => {
    expect(xml).toMatch(/<pubDate>[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4}/);
  });
});

describe("categorySlug", () => {
  it("convierte el nombre de la categoría en una ruta limpia", () => {
    expect(categorySlug("Thought Leadership")).toBe("thought-leadership");
    expect(categorySlug("Workforce Data")).toBe("workforce-data");
  });

  it("aguanta acentos, signos y espacios de sobra", () => {
    expect(categorySlug("  Formación & Práctica  ")).toBe("formacion-practica");
  });
});

describe("categorías del contenido real", () => {
  it("lista cada categoría una sola vez, con su conteo", () => {
    const categorias = getAllCategories();

    expect(categorias.length).toBeGreaterThan(0);
    for (const c of categorias) {
      expect(c.slug).toBe(categorySlug(c.name));
      expect(c.count).toBeGreaterThan(0);
    }
    const slugs = categorias.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("devuelve los papers de una categoría y nada más", () => {
    const [primera] = getAllCategories();
    const papers = getPapersByCategory(primera.slug);

    expect(papers).toHaveLength(primera.count);
    for (const paper of papers) {
      expect(categorySlug(paper.category)).toBe(primera.slug);
    }
  });

  it("una categoría inexistente devuelve lista vacía", () => {
    expect(getPapersByCategory("no-existe")).toEqual([]);
  });
});
