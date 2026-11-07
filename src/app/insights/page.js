import Link from "next/link";
import styles from "./page.module.css";
import PaperCard from "../../components/PaperCard";
import { getT } from "../../i18n/server";
import { getAllCategories, getAllPapers } from "../../lib/insights";
import { organizationSchema, SITE_URL } from "../../lib/insightsSeo";

const DESCRIPCION =
  "Research and point of view from Distinct Hospitality Solutions on workforce intelligence, training and technology in hospitality.";

export const metadata = {
  title: "White Papers and Research for Hospitality Leaders | Distinct",
  description: DESCRIPCION,
  alternates: {
    canonical: `${SITE_URL}/insights`,
    types: { "application/rss+xml": `${SITE_URL}/insights/feed.xml` },
  },
  openGraph: {
    title: "Distinct Insights",
    description: DESCRIPCION,
    url: `${SITE_URL}/insights`,
    type: "website",
  },
};

export default async function InsightsHub() {
  const t = await getT("insights");
  const papers = getAllPapers();
  const categorias = getAllCategories();
  const [destacado, ...resto] = papers;

  return (
    <div className={styles.page}>
      {/* Identidad de la empresa para Google. Va en el índice porque es la
          página raíz de la sección (sección 6 de la ficha). */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema()) }}
      />

      <header className={styles.header}>
        <div className="container">
          <span className={styles.eyebrow}>{t("label")}</span>
          <h1 className={styles.title}>{t("hubTitle")}</h1>
          <p className={styles.intro}>{t("hubIntro")}</p>
        </div>
      </header>

      <section className={styles.listSection} aria-label={t("hubTitle")}>
        <div className="container">
          {/* El filtro solo aparece cuando hay más de una categoría: con una
              sola es ruido que no filtra nada. */}
          {categorias.length > 1 && (
            <nav className={styles.categories} aria-label={t("categoryLabel")}>
              {categorias.map((c) => (
                <Link
                  key={c.slug}
                  href={`/insights/category/${c.slug}`}
                  className={styles.categoryLink}
                >
                  {c.name} <span className={styles.categoryCount}>{c.count}</span>
                </Link>
              ))}
            </nav>
          )}

          {papers.length === 0 ? (
            <p className={styles.empty}>{t("empty")}</p>
          ) : (
            <>
              <PaperCard paper={destacado} readLabel={t("readPaper")} destacado />
              {resto.length > 0 && (
                <div className={styles.grid}>
                  {resto.map((paper) => (
                    <PaperCard key={paper.slug} paper={paper} readLabel={t("readPaper")} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
