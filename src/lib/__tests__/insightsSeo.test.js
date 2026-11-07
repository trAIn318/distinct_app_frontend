import { describe, it, expect } from "vitest";

// Datos estructurados JSON-LD del centro de white papers (sección 6 de la
// ficha). Son lo que hace que Google muestre el artículo como resultado
// enriquecido; si salen mal, no hay error visible en la página — simplemente
// nunca aparecen. Por eso se prueban.
import {
  articleSchema,
  faqSchema,
  breadcrumbSchema,
  organizationSchema,
  paperUrl,
  SITE_URL,
} from "../insightsSeo";

const PAPER = {
  slug: "ai-automation-in-hospitality",
  title: "Where We Automate, and Why",
  metaDescription: "Donde pertenece la automatizacion en hospitalidad.",
  author: "Fresa V Straw",
  publishDate: "2026-11-07",
  faq: [
    { question: "Should hotels use AI at the front desk?", answer: "Depende de la propiedad." },
    { question: "Why can't AI replace human hospitality?", answer: "Las personas leen la sala." },
  ],
};

describe("paperUrl", () => {
  it("devuelve una URL absoluta bajo /insights", () => {
    // JSON-LD exige URLs absolutas: una ruta relativa se ignora en silencio.
    expect(paperUrl(PAPER.slug)).toBe(`${SITE_URL}/insights/${PAPER.slug}`);
  });
});

describe("articleSchema", () => {
  it("declara un Article con titular y descripción", () => {
    const schema = articleSchema(PAPER);

    expect(schema["@type"]).toBe("Article");
    expect(schema.headline).toBe("Where We Automate, and Why");
    expect(schema.description).toBe(PAPER.metaDescription);
  });

  it("usa como autor el mismo nombre que se ve en la página", () => {
    // El documento de contenido lo pide explícitamente: el byline visible y el
    // dato estructurado tienen que decir lo mismo, o Google los desempareja.
    const schema = articleSchema(PAPER);

    expect(schema.author["@type"]).toBe("Person");
    expect(schema.author.name).toBe("Fresa V Straw");
  });

  it("si no hay fecha de actualización, usa la de publicación", () => {
    const schema = articleSchema(PAPER);

    expect(schema.datePublished).toBe("2026-11-07");
    expect(schema.dateModified).toBe("2026-11-07");
  });

  it("respeta la fecha de actualización cuando existe", () => {
    const schema = articleSchema({ ...PAPER, updatedDate: "2026-12-01" });

    expect(schema.dateModified).toBe("2026-12-01");
  });

  it("lleva publisher con logo", () => {
    const schema = articleSchema(PAPER);

    expect(schema.publisher["@type"]).toBe("Organization");
    expect(schema.publisher.logo.url).toMatch(/^https:\/\//);
  });
});

describe("faqSchema", () => {
  it("convierte cada pregunta en un Question con su respuesta", () => {
    const schema = faqSchema(PAPER);

    expect(schema["@type"]).toBe("FAQPage");
    expect(schema.mainEntity).toHaveLength(2);
    expect(schema.mainEntity[0].name).toBe("Should hotels use AI at the front desk?");
    expect(schema.mainEntity[0].acceptedAnswer.text).toBe("Depende de la propiedad.");
  });

  it("devuelve null si el paper no tiene preguntas", () => {
    // Un FAQPage vacío es inválido y la Prueba de Resultados Enriquecidos lo
    // marca como error. Mejor no emitir nada.
    expect(faqSchema({ ...PAPER, faq: [] })).toBeNull();
    expect(faqSchema({ ...PAPER, faq: undefined })).toBeNull();
  });
});

describe("breadcrumbSchema", () => {
  it("arma Inicio → Insights → título, en ese orden", () => {
    const schema = breadcrumbSchema(PAPER);

    expect(schema["@type"]).toBe("BreadcrumbList");
    expect(schema.itemListElement.map((i) => i.name)).toEqual([
      "Home",
      "Insights",
      "Where We Automate, and Why",
    ]);
    expect(schema.itemListElement.map((i) => i.position)).toEqual([1, 2, 3]);
  });

  it("todas las migas apuntan a URLs absolutas", () => {
    const schema = breadcrumbSchema(PAPER);

    for (const item of schema.itemListElement) {
      expect(item.item).toMatch(/^https:\/\//);
    }
  });
});

describe("organizationSchema", () => {
  it("identifica a la empresa con nombre, URL y logo", () => {
    const schema = organizationSchema();

    expect(schema["@type"]).toBe("Organization");
    expect(schema.name).toBe("Distinct Hospitality Solutions");
    expect(schema.url).toBe(SITE_URL);
    expect(schema.logo).toMatch(/^https:\/\//);
  });

  it("no inventa redes sociales que nadie nos ha dado", () => {
    // sameAs con un perfil equivocado le dice a Google que ese es el negocio.
    // Mientras Verónica no mande los enlaces reales, el campo no va.
    const schema = organizationSchema();

    expect(schema.sameAs).toBeUndefined();
  });
});
