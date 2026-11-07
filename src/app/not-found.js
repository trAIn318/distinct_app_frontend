import Link from "next/link";
import styles from "./not-found.module.css";
import { getT } from "../i18n/server";

/**
 * 404 propio (FR-12 de la ficha). Antes se servía el genérico de Next, que es
 * una pantalla en blanco sin marca ni salida: quien llegaba por un enlace roto
 * se iba del sitio. Enlaza al inicio y al centro de white papers.
 */
export const metadata = {
  title: "Page not found | Distinct Hospitality Solutions",
  // Un 404 indexado compite con las páginas reales en los resultados.
  robots: { index: false, follow: true },
};

export default async function NotFound() {
  const t = await getT("notFound");

  return (
    <div className={styles.page}>
      <div className="container">
        <span className={styles.code}>{t("code")}</span>
        <h1 className={styles.title}>{t("title")}</h1>
        <p className={styles.body}>{t("body")}</p>

        <div className={styles.actions}>
          <Link href="/" className="btn-primary">
            {t("home")}
          </Link>
          <Link href="/insights" className={`${styles.secondary} link-underline`}>
            {t("insights")}
          </Link>
        </div>
      </div>
    </div>
  );
}
