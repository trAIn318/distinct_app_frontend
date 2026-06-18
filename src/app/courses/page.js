import { Suspense } from "react";
import { getCourses } from "../../lib/api";
import { MOODLE_URL } from "../../lib/config";
import { getT } from "../../i18n/server";
import CoursesExplorer from "../../components/CoursesExplorer";
import Reveal from "../../components/Reveal";
import styles from "./page.module.css";

export const metadata = {
  title: "Courses | Distinct Hospitality Solutions",
  description:
    "Role-specific hospitality training built by industry experts. Front Desk, Bartending, Housekeeping, Food Safety, and more.",
};

export default async function CoursesPage() {
  const t = await getT("coursesPage");
  const courses = await getCourses();

  return (
    <div className={styles.page}>
      {/* Hero */}
      <section className={styles.hero} aria-labelledby="courses-hero">
        <Reveal className="container">
          <span className={styles.heroTag}>{t("tag")}</span>
          <h1 id="courses-hero" className={styles.heroH1}>
            {t("titlePre")}{" "}
            <span className="emphasized gold">{t("titleEmphasis")}</span>{" "}
            {t("titlePost")}
          </h1>
          <p className={styles.heroSubLabel}>{t("subtitle")}</p>
          {/* Botón de acceso a Moodle ocultado temporalmente (puede reactivarse). */}
          {/* <div className={styles.heroActions}>
            <a
              href={MOODLE_URL}
              className="btn-white"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("accessMoodle")}
            </a>
          </div> */}
        </Reveal>
      </section>

      {/* Catálogo interactivo: búsqueda + filtros + 3 vistas */}
      <section className={styles.gridSection} aria-labelledby="courses-grid-heading">
        <div className="container">
          <h2 id="courses-grid-heading" className="sr-only">
            {t("allCourses")}
          </h2>

          {courses.length === 0 ? (
            <div className={styles.emptyState}>
              <p>{t("empty")}</p>
            </div>
          ) : (
            // Suspense: CoursesExplorer usa useSearchParams (estado en la URL)
            <Suspense fallback={null}>
              <CoursesExplorer courses={courses} />
            </Suspense>
          )}
        </div>
      </section>
    </div>
  );
}
