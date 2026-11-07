import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import styles from "./page.module.css";
import { getT } from "../../../i18n/server";
import { getAllPapers, getPaperBySlug } from "../../../lib/insights";
import {
  articleSchema,
  breadcrumbSchema,
  faqSchema,
  paperUrl,
} from "../../../lib/insightsSeo";

export function generateStaticParams() {
  return getAllPapers().map((paper) => ({ slug: paper.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const paper = getPaperBySlug(slug);
  if (!paper) return {};

  const url = paperUrl(paper.slug);
  return {
    title: paper.metaTitle,
    description: paper.metaDescription,
    keywords: [paper.keyword, ...(paper.secondaryKeywords || [])],
    authors: [{ name: paper.author }],
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title: paper.title,
      description: paper.metaDescription,
      url,
      publishedTime: paper.publishDate,
      modifiedTime: paper.updatedDate || paper.publishDate,
      authors: [paper.author],
    },
    twitter: {
      card: "summary_large_image",
      title: paper.title,
      description: paper.metaDescription,
    },
  };
}

/** Fecha legible y estable. `en-CA` da AAAA-MM-DD sin depender del locale. */
function fecha(valor) {
  return String(valor).slice(0, 10);
}

export default async function PaperPage({ params }) {
  const { slug } = await params;
  const paper = getPaperBySlug(slug);
  if (!paper) notFound();

  const t = await getT("insights");
  const faq = faqSchema(paper);
  const schemas = [articleSchema(paper), breadcrumbSchema(paper), faq].filter(Boolean);

  return (
    <div className={styles.page}>
      {schemas.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}

      <article className={styles.article}>
        <header className={styles.header}>
          <div className="container">
            {/* Migas de pan visibles. El dato estructurado que las acompaña va
                arriba en BreadcrumbList (sección 6 de la ficha). */}
            <nav className={styles.breadcrumb} aria-label="Breadcrumb">
              <Link href="/">{t("breadcrumbHome")}</Link>
              <span aria-hidden="true">/</span>
              <Link href="/insights">{t("breadcrumbHub")}</Link>
            </nav>

            <span className={styles.eyebrow}>{paper.label || t("label")}</span>
            <h1 className={styles.title}>{paper.title}</h1>
            {paper.subtitle && <p className={styles.subtitle}>{paper.subtitle}</p>}

            <p className={styles.byline}>
              By {paper.author}
              {paper.authorRole ? `, ${paper.authorRole}` : ""}
            </p>

            <p className={styles.meta}>
              <span>
                {t("published")} <time dateTime={fecha(paper.publishDate)}>{fecha(paper.publishDate)}</time>
              </span>
              {paper.updatedDate && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    {t("updated")}{" "}
                    <time dateTime={fecha(paper.updatedDate)}>{fecha(paper.updatedDate)}</time>
                  </span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span>{paper.readTime}</span>
            </p>
          </div>
        </header>

        <div className="container">
          <div className={styles.body}>
            <section aria-labelledby="summary-heading">
              <h2 id="summary-heading" className={styles.sectionTitle}>
                {t("summaryHeading")}
              </h2>
              {String(paper.summary)
                .split("\n\n")
                .map((parrafo, i) => (
                          <p key={i} className={styles.lead}>
                    {parrafo.trim()}
                  </p>
                ))}
            </section>

            {paper.keyIdeas?.length > 0 && (
              <section aria-labelledby="ideas-heading">
                <h2 id="ideas-heading" className={styles.sectionTitle}>
                  {t("keyIdeasHeading")}
                </h2>
                {paper.keyIdeas.map((idea) => (
                  <div key={idea.heading} className={styles.idea}>
                    <h3 className={styles.ideaTitle}>{idea.heading}</h3>
                    <p className={styles.ideaBody}>{idea.body}</p>
                  </div>
                ))}
              </section>
            )}

            {paper.pullQuote && (
              <blockquote className={styles.pullQuote}>{paper.pullQuote}</blockquote>
            )}

            {/* El cuerpo del paper. El HTML sale de un Markdown propio del
                repositorio, nunca de un visitante. */}
            <section
              className={styles.prose}
              dangerouslySetInnerHTML={{ __html: paper.bodyHtml }}
            />

            {paper.callout && (
              <aside className={styles.callout}>
                <p className={styles.calloutHeading}>{paper.callout.heading}</p>
                <p className={styles.calloutBody}>{paper.callout.body}</p>
              </aside>
            )}

            {paper.pdfFile && (
              <section className={styles.download} aria-labelledby="download-heading">
                <h2 id="download-heading" className={styles.downloadHeading}>
                  {t("downloadHeading")}
                </h2>
                <p className={styles.downloadSupport}>{t("downloadSupport")}</p>
                <a
                  className="btn-primary"
                  href={`/insights/pdf/${paper.pdfFile}`}
                  download
                >
                  {t("downloadButton")}
                </a>
              </section>
            )}

            {paper.faq?.length > 0 && (
              <section aria-labelledby="faq-heading">
                <h2 id="faq-heading" className={styles.sectionTitle}>
                  {t("faqHeading")}
                </h2>
                {paper.faq.map((item) => (
                  <div key={item.question} className={styles.faqItem}>
                    <h3 className={styles.faqQuestion}>{item.question}</h3>
                    <p className={styles.faqAnswer}>{item.answer}</p>
                  </div>
                ))}
              </section>
            )}

            {paper.authorBio && (
              <section className={styles.author} aria-labelledby="author-heading">
                <h2 id="author-heading" className={styles.sectionTitle}>
                  {t("authorHeading")}
                </h2>
                <div className={styles.authorRow}>
                  {paper.authorImage && (
                    <Image
                      src={paper.authorImage}
                      alt={`${paper.author}, ${paper.authorRole || ""}`.trim()}
                      width={96}
                      height={96}
                      className={styles.authorImage}
                    />
                  )}
                  <div>
                    <p className={styles.authorName}>{paper.author}</p>
                    <p className={styles.authorBio}>{paper.authorBio}</p>
                  </div>
                </div>
              </section>
            )}

            <p className={styles.back}>
              <Link href="/insights" className="link-underline">
                ← {t("backToHub")}
              </Link>
            </p>
          </div>
        </div>
      </article>
    </div>
  );
}
