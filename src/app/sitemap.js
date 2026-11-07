/**
 * src/app/sitemap.js — /sitemap.xml
 *
 * El sitio no tenía sitemap. La ficha lo pide (sección 7, FR-10) pero le sirve
 * a todas las páginas públicas, no solo al centro de white papers.
 *
 * Solo entran páginas públicas y estables. Las de sesión (login, registro,
 * cuenta, tablero, ajustes) quedan fuera a propósito: invitar a Google a
 * rastrearlas gasta presupuesto de rastreo y expone rutas que no aportan nada
 * en resultados de búsqueda.
 */
import { SITE_URL } from "../lib/config";
import { getAllCategories, getAllPapers } from "../lib/insights";

// Rutas públicas fijas. `changeFrequency` y `priority` son pistas, no órdenes:
// Google las toma como sugerencia.
const PAGINAS_FIJAS = [
  { ruta: "/", changeFrequency: "weekly", priority: 1 },
  { ruta: "/insights", changeFrequency: "weekly", priority: 0.9 },
  { ruta: "/about", changeFrequency: "monthly", priority: 0.7 },
  { ruta: "/courses", changeFrequency: "weekly", priority: 0.8 },
  { ruta: "/privacy-policy", changeFrequency: "yearly", priority: 0.3 },
  { ruta: "/cookie-policy", changeFrequency: "yearly", priority: 0.3 },
];

export default function sitemap() {
  const ahora = new Date();

  const fijas = PAGINAS_FIJAS.map((p) => ({
    url: `${SITE_URL}${p.ruta}`,
    lastModified: ahora,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));

  const papers = getAllPapers().map((paper) => ({
    url: `${SITE_URL}/insights/${paper.slug}`,
    lastModified: new Date(paper.updatedDate || paper.publishDate),
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  const categorias = getAllCategories().map((categoria) => ({
    url: `${SITE_URL}/insights/category/${categoria.slug}`,
    lastModified: ahora,
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  return [...fijas, ...papers, ...categorias];
}
