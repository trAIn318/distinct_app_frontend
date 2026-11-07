/**
 * src/lib/insights.js — el contenido del centro de white papers (/insights).
 *
 * Cada paper es un archivo Markdown con frontmatter en `content/insights/`.
 * Eso es lo que pide FR-2 de la ficha y lo que permite publicar agregando un
 * archivo, sin tocar código (US-7).
 *
 * El YAML que se parsea aquí son archivos propios del repositorio, leídos en
 * tiempo de build. Nunca entra contenido de un visitante, así que el cuerpo se
 * convierte a HTML y se inserta tal cual.
 */
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { marked } from "marked";

/**
 * Campos sin los cuales la página saldría rota o mal indexada. Falta uno y el
 * build se cae nombrándolo: es preferible a enterarse por Google semanas
 * después (US-7).
 *
 * Quedan FUERA a propósito los opcionales de FR-2 — `authorBio`,
 * `updatedDate`, `coverImage`, `ogImage`, `pdfFile`, `faq` — porque un paper
 * puede publicarse sin ellos.
 */
export const REQUIRED_FRONTMATTER = [
  "title",
  "slug",
  "keyword",
  "metaTitle",
  "metaDescription",
  "author",
  "category",
  "publishDate",
  "readTime",
  "summary",
];

function validar(datos, archivo) {
  const faltantes = REQUIRED_FRONTMATTER.filter((campo) => {
    const valor = datos[campo];
    return valor === undefined || valor === null || String(valor).trim() === "";
  });
  if (faltantes.length > 0) {
    throw new Error(
      `${archivo}: faltan campos obligatorios en el frontmatter: ${faltantes.join(", ")}`
    );
  }
}

/** Dónde viven los papers. Fuera de `src/` para que se note que es contenido. */
export const PAPERS_DIR = path.join(process.cwd(), "content", "insights");

export function getPaperBySlug(slug, dir = PAPERS_DIR) {
  const archivo = `${slug}.md`;
  let raw;
  try {
    raw = fs.readFileSync(path.join(dir, archivo), "utf8");
  } catch (err) {
    // "No existe" no es un error del sitio: la ruta responde 404 (FR-12).
    // Cualquier otro fallo de lectura sí tiene que salir a la luz.
    if (err.code === "ENOENT") return null;
    throw err;
  }

  const { data, content } = matter(raw);
  validar(data, archivo);

  return { ...data, bodyHtml: marked.parse(content) };
}

/**
 * Ruta limpia a partir del nombre de una categoría: "Thought Leadership" →
 * "thought-leadership". Quita acentos porque una URL con tilde se escapa a
 * `%C3%B3` y queda ilegible al compartirla.
 */
export function categorySlug(nombre) {
  return String(nombre)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Cada categoría una sola vez, con cuántos papers tiene (US-8). */
export function getAllCategories(dir = PAPERS_DIR) {
  const porSlug = new Map();
  for (const paper of getAllPapers(dir)) {
    const slug = categorySlug(paper.category);
    const actual = porSlug.get(slug);
    if (actual) actual.count += 1;
    else porSlug.set(slug, { slug, name: paper.category, count: 1 });
  }
  return [...porSlug.values()];
}

export function getPapersByCategory(slug, dir = PAPERS_DIR) {
  return getAllPapers(dir).filter((p) => categorySlug(p.category) === slug);
}

/** Todos los papers publicados, del más nuevo al más viejo (US-1). */
export function getAllPapers(dir = PAPERS_DIR) {
  let archivos;
  try {
    archivos = fs.readdirSync(dir);
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }

  return archivos
    .filter((nombre) => nombre.endsWith(".md"))
    .map((nombre) => getPaperBySlug(nombre.slice(0, -".md".length), dir))
    .filter(Boolean)
    .sort((a, b) => String(b.publishDate).localeCompare(String(a.publishDate)));
}
