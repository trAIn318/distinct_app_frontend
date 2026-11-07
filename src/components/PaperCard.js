import Link from "next/link";
import styles from "./PaperCard.module.css";

/**
 * Tarjeta de un white paper. La usan el índice del centro y las páginas de
 * categoría, por eso vive aquí y no dentro de una ruta.
 *
 * `destacado` lo usa el paper que encabeza el índice (US-1).
 */
export default function PaperCard({ paper, readLabel, destacado = false }) {
  return (
    <article className={`${styles.card} ${destacado ? styles.cardFeatured : ""}`}>
      <Link href={`/insights/${paper.slug}`} className={styles.cardLink}>
        <span className={styles.cardMeta}>
          <span className={styles.cardCategory}>{paper.category}</span>
          <span aria-hidden="true">·</span>
          <span>{paper.readTime}</span>
        </span>

        <h2 className={destacado ? styles.cardTitleFeatured : styles.cardTitle}>
          {paper.title}
        </h2>

        {paper.subtitle && <p className={styles.cardSubtitle}>{paper.subtitle}</p>}

        <span className={`${styles.cardCta} link-underline`}>{readLabel}</span>
      </Link>
    </article>
  );
}
