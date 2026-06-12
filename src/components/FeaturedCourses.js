/**
 * FeaturedCourses
 * Sección de la home con N cursos destacados (N viene de NEXT_PUBLIC_HOME_COURSES_COUNT).
 * Es server component → fetcha en build/SSR, no hace round-trip desde el cliente.
 */

import Link from "next/link";
import { getCourses } from "../lib/api";
import { HOME_COURSES_COUNT } from "../lib/config";
import CourseCard from "./CourseCard";
import Reveal from "./Reveal";
import { getT } from "../i18n/server";
import styles from "./FeaturedCourses.module.css";

export default async function FeaturedCourses() {
  const t = await getT("featured");
  const courses = await getCourses({ limit: HOME_COURSES_COUNT });

  // Si el backend no responde, no rompemos el render — escondemos la sección
  if (!courses || courses.length === 0) {
    return null;
  }

  return (
    <section className={styles.section} aria-labelledby="featured-courses-heading">
      <div className="container">
        <Reveal>
          <span className={styles.eyebrow}>{t("eyebrow")}</span>
          <h2 id="featured-courses-heading" className={styles.headline}>
            {t("titlePre")}{" "}
            <span className="emphasized gold">{t("titleEmphasis")}</span>
            {t("titlePost")}
          </h2>
          <p className={styles.intro}>{t("intro")}</p>
        </Reveal>

        <Reveal group className={styles.grid}>
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </Reveal>

        <Reveal className={styles.viewAll}>
          <Link href="/courses" className="btn-ghost">
            {t("viewAll")}
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
