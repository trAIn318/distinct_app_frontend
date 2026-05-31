/**
 * FeaturedCourses
 * Sección de la home con N cursos destacados (N viene de NEXT_PUBLIC_HOME_COURSES_COUNT).
 * Es server component → fetcha en build/SSR, no hace round-trip desde el cliente.
 */

import Link from "next/link";
import { getCourses } from "../lib/api";
import { HOME_COURSES_COUNT } from "../lib/config";
import CourseCard from "./CourseCard";
import styles from "./FeaturedCourses.module.css";

export default async function FeaturedCourses() {
  const courses = await getCourses({ limit: HOME_COURSES_COUNT });

  // Si el backend no responde, no rompemos el render — escondemos la sección
  if (!courses || courses.length === 0) {
    return null;
  }

  return (
    <section className={styles.section} aria-labelledby="featured-courses-heading">
      <div className="container">
        <span className={styles.eyebrow}>Featured Courses</span>
        <h2 id="featured-courses-heading" className={styles.headline}>
          Training Built by <span className="emphasized gold">Hospitality Experts</span>.
        </h2>
        <p className={styles.intro}>
          A curated preview of our programs. Every course is role-specific, multilingual, and built around the moments that drive real revenue.
        </p>

        <div className={styles.grid}>
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>

        <div className={styles.viewAll}>
          <Link href="/courses" className="btn-ghost">
            View All Courses →
          </Link>
        </div>
      </div>
    </section>
  );
}
