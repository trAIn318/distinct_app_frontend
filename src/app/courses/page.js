import { getCourses } from "../../lib/api";
import { MOODLE_URL } from "../../lib/config";
import CourseCard from "../../components/CourseCard";
import Reveal from "../../components/Reveal";
import styles from "./page.module.css";

export const metadata = {
  title: "Courses | Distinct Hospitality Solutions",
  description:
    "Role-specific hospitality training built by industry experts. Front Desk, Bartending, Housekeeping, Food Safety, and more.",
};

export default async function CoursesPage() {
  const courses = await getCourses();

  return (
    <div className={styles.page}>
      {/* Hero */}
      <section className={styles.hero} aria-labelledby="courses-hero">
        <Reveal className="container">
          <span className={styles.heroTag}>Training Library</span>
          <h1 id="courses-hero" className={styles.heroH1}>
            Every Course.{" "}
            <span className="emphasized gold">Every Role.</span>{" "}
            Every Shift.
          </h1>
          <p className={styles.heroSubLabel}>
            Role-specific hospitality programs, multilingual, ready for your team.
            Browse the catalog or jump straight into Moodle if you&apos;re already enrolled.
          </p>
          <div className={styles.heroActions}>
            <a
              href={MOODLE_URL}
              className="btn-white"
              target="_blank"
              rel="noopener noreferrer"
            >
              Access Moodle
            </a>
          </div>
        </Reveal>
      </section>

      {/* Courses grid */}
      <section className={styles.gridSection} aria-labelledby="courses-grid-heading">
        <div className="container">
          <h2 id="courses-grid-heading" className="sr-only">
            All Courses
          </h2>

          {courses.length === 0 ? (
            <div className={styles.emptyState}>
              <p>The catalog is being updated. Please check back soon, or contact us directly.</p>
            </div>
          ) : (
            <Reveal group className={styles.grid}>
              {courses.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </Reveal>
          )}
        </div>
      </section>
    </div>
  );
}
