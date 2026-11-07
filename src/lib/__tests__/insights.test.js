import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// El centro de white papers guarda cada paper como un archivo Markdown con
// frontmatter (FR-2 de la ficha). Eso es lo que permite que alguien publique
// agregando un archivo, sin tocar código (US-7).
import { getPaperBySlug, getAllPapers, REQUIRED_FRONTMATTER } from "../insights";

let dir;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "insights-"));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

function escribirPaper(nombre, contenido) {
  fs.writeFileSync(path.join(dir, nombre), contenido, "utf8");
}

const PAPER_MINIMO = `---
title: "Where We Automate, and Why"
slug: "ai-automation-in-hospitality"
keyword: "AI automation in hospitality"
metaTitle: "AI Automation in Hospitality | Distinct"
metaDescription: "Donde pertenece la automatizacion en hospitalidad."
author: "Fresa V Straw"
category: "Thought Leadership"
publishDate: "2026-11-07"
readTime: "4 min"
summary: "Un resumen corto."
---

El primer parrafo del paper.
`;

// El mismo paper, pero sin la meta descripcion. Se escribe completo a proposito
// en vez de recortarlo con una expresion regular: el fixture roto tiene que ser
// obvio a simple vista.
const PAPER_SIN_META = `---
title: "Where We Automate, and Why"
slug: "ai-automation-in-hospitality"
keyword: "AI automation in hospitality"
metaTitle: "AI Automation in Hospitality | Distinct"
author: "Fresa V Straw"
category: "Thought Leadership"
publishDate: "2026-11-07"
readTime: "4 min"
summary: "Un resumen corto."
---

El primer parrafo del paper.
`;

describe("getPaperBySlug", () => {
  it("lee el frontmatter del archivo", () => {
    escribirPaper("ai-automation-in-hospitality.md", PAPER_MINIMO);

    const paper = getPaperBySlug("ai-automation-in-hospitality", dir);

    expect(paper.title).toBe("Where We Automate, and Why");
    expect(paper.author).toBe("Fresa V Straw");
    expect(paper.keyword).toBe("AI automation in hospitality");
  });
});

describe("getPaperBySlug — el cuerpo", () => {
  it("convierte el Markdown del cuerpo en HTML", () => {
    escribirPaper("ai-automation-in-hospitality.md", PAPER_MINIMO);

    const paper = getPaperBySlug("ai-automation-in-hospitality", dir);

    expect(paper.bodyHtml).toContain("<p>El primer parrafo del paper.</p>");
  });

  it("no mete el frontmatter dentro del cuerpo", () => {
    escribirPaper("ai-automation-in-hospitality.md", PAPER_MINIMO);

    const paper = getPaperBySlug("ai-automation-in-hospitality", dir);

    expect(paper.bodyHtml).not.toContain("metaTitle");
  });
});

describe("getPaperBySlug — frontmatter incompleto", () => {
  it("falla nombrando el archivo y el campo que falta", () => {
    // Sin esto, un paper al que se le olvidó la meta descripción se publica
    // igual y el fallo aparece en Google, no en el build (US-7).
    escribirPaper("roto.md", PAPER_SIN_META);

    expect(() => getPaperBySlug("roto", dir)).toThrow("roto.md");
    expect(() => getPaperBySlug("roto", dir)).toThrow("metaDescription");
  });

  it("declara qué campos son obligatorios", () => {
    expect(REQUIRED_FRONTMATTER).toContain("title");
    expect(REQUIRED_FRONTMATTER).toContain("slug");
    expect(REQUIRED_FRONTMATTER).toContain("metaDescription");
    expect(REQUIRED_FRONTMATTER).toContain("publishDate");
  });
});

describe("getPaperBySlug — slug inexistente", () => {
  it("devuelve null en vez de reventar", () => {
    // La ruta /insights/[slug] necesita distinguir "no existe" (404 limpio,
    // FR-12) de "existe pero está mal escrito" (build roto).
    expect(getPaperBySlug("no-existe", dir)).toBeNull();
  });
});

describe("getAllPapers", () => {
  function conFecha(slug, fecha) {
    return PAPER_MINIMO.replace('slug: "ai-automation-in-hospitality"', `slug: "${slug}"`)
      .replace('publishDate: "2026-11-07"', `publishDate: "${fecha}"`);
  }

  it("lista del más nuevo al más viejo", () => {
    escribirPaper("viejo.md", conFecha("viejo", "2026-01-15"));
    escribirPaper("nuevo.md", conFecha("nuevo", "2026-11-01"));
    escribirPaper("medio.md", conFecha("medio", "2026-06-20"));

    const slugs = getAllPapers(dir).map((p) => p.slug);

    expect(slugs).toEqual(["nuevo", "medio", "viejo"]);
  });

  it("ignora los archivos que no son Markdown", () => {
    escribirPaper("uno.md", conFecha("uno", "2026-05-05"));
    escribirPaper("notas.txt", "esto no es un paper");
    escribirPaper("borrador.md.bak", "tampoco");

    expect(getAllPapers(dir)).toHaveLength(1);
  });

  it("devuelve lista vacía si no hay carpeta", () => {
    expect(getAllPapers(path.join(dir, "no-existe"))).toEqual([]);
  });
});

describe("el contenido real del repositorio", () => {
  it("el Paper 1 carga y pasa la validación", () => {
    // Guarda contra publicar con el frontmatter incompleto: si a alguien se le
    // olvida un campo, esto se pone rojo antes del despliegue.
    const paper = getPaperBySlug("ai-automation-in-hospitality");

    expect(paper).not.toBeNull();
    expect(paper.title).toBe("Where We Automate, and Why");
    expect(paper.bodyHtml.length).toBeGreaterThan(1000);
  });

  it("todos los papers publicados tienen el frontmatter completo", () => {
    const papers = getAllPapers();

    expect(papers.length).toBeGreaterThan(0);
    for (const paper of papers) {
      for (const campo of REQUIRED_FRONTMATTER) {
        expect(paper[campo], `${paper.slug} → ${campo}`).toBeTruthy();
      }
    }
  });
});
