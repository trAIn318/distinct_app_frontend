import Link from "next/link";
import { notFound } from "next/navigation";
import styles from "./page.module.css";
import PaperCard from "../../../../components/PaperCard";
import { getT } from "../../../../i18n/server";
import { getAllCategories, getPapersByCategory } from "../../../../lib/insights";
import { SITE_URL } from "../../../../lib/insightsSeo";

export function generateStaticParams() {
  return getAllCategories().map((c) => ({ slug: c.slug }));
}

function buscarCategoria(slug) {
  return getAllCategories().find((c) => c.slug === slug) || null;
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const categoria = buscarCategoria(slug);
  if (!categoria) return {};

  const url = `${SITE_URL}/insights/category/${categoria.slug}`;
  const descripcion = `White papers and research from Distinct Hospitality Solutions on ${categoria.name}.`;

  return {
    // Cada página de categoría necesita su propio título, descripción y
    // canónica, o Google las lee como copias del índice (US-8).
    title: `${categoria.name} | Distinct Insights`,
    description: descripcion,
    alternates: { canonical: url },
    openGraph: { title: categoria.name, description: descripcion, url, type: "website" },
  };
}

export default async function CategoryPage({ params }) {
  const { slug } = await params;
  const categoria = buscarCategoria(slug);
  if (!categoria) notFound();

  const t = await getT("insights");
  const papers = getPapersByCategory(slug);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className="container">
          <nav className={styles.breadcrumb} aria-label="Breadcrumb">
            <Link href="/">{t("breadcrumbHome")}</Link>
            <span aria-hidden="true">/</span>
            <Link href="/insights">{t("breadcrumbHub")}</Link>
          </nav>

          <span className={styles.eyebrow}>{t("categoryLabel")}</span>
          <h1 className={styles.title}>{categoria.name}</h1>
          <p className={styles.intro}>{t("categoryIntro")}</p>
        </div>
      </header>

      <section className={styles.listSection} aria-label={categoria.name}>
        <div className="container">
          <div className={styles.grid}>
            {papers.map((paper) => (
              <PaperCard key={paper.slug} paper={paper} readLabel={t("readPaper")} />
            ))}
          </div>

          <p className={styles.back}>
            <Link href="/insights" className="link-underline">
              ← {t("backToHub")}
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
