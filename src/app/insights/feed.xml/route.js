/**
 * /insights/feed.xml — feed RSS del centro (sección 7 de la ficha).
 *
 * El XML lo arma `buildInsightsFeed`, que está probado aparte. Aquí solo se
 * sirve con el tipo de contenido correcto: con `text/html` los lectores de RSS
 * lo rechazan.
 */
import { getAllPapers } from "../../../lib/insights";
import { buildInsightsFeed } from "../../../lib/insightsFeed";

export const dynamic = "force-static";

export function GET() {
  return new Response(buildInsightsFeed(getAllPapers()), {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600",
    },
  });
}
