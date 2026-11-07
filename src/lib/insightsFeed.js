/**
 * src/lib/insightsFeed.js — feed RSS del centro (/insights/feed.xml).
 *
 * Lo pide la sección 7 de la ficha. Es función pura a propósito: así se puede
 * probar el XML sin levantar el servidor.
 */
import { SITE_URL } from "./config";

export const FEED_TITLE = "Distinct Insights";
export const FEED_DESCRIPTION =
  "White papers and research for hospitality leaders, from Distinct Hospitality Solutions.";

/**
 * Un `&` o un `<` sin escapar deja el feed ilegible para cualquier lector de
 * RSS. Se escapa todo el texto que entra, siempre.
 */
function escapar(texto) {
  return String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** RSS exige fechas RFC 822, no ISO. `toUTCString()` da justamente eso. */
function fechaRfc822(valor) {
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? new Date().toUTCString() : d.toUTCString();
}

export function buildInsightsFeed(papers) {
  const items = papers
    .map((paper) => {
      const url = `${SITE_URL}/insights/${paper.slug}`;
      return `    <item>
      <title>${escapar(paper.title)}</title>
      <link>${escapar(url)}</link>
      <guid isPermaLink="true">${escapar(url)}</guid>
      <description>${escapar(paper.metaDescription)}</description>
      <category>${escapar(paper.category)}</category>
      <pubDate>${fechaRfc822(paper.publishDate)}</pubDate>
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapar(FEED_TITLE)}</title>
    <link>${SITE_URL}/insights</link>
    <description>${escapar(FEED_DESCRIPTION)}</description>
    <language>en</language>
    <atom:link href="${SITE_URL}/insights/feed.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`;
}
