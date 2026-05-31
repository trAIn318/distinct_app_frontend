/**
 * CourseCard
 * Renderiza un curso individual. Server component — solo recibe props.
 *
 * Las dos acciones del PRD del usuario:
 *   - "View more"          → /courses/<id>   (detalle, fase próxima)
 *   - "I'm interested"     → /login?next=/courses/<id>&intent=interest  (fase 2 con auth)
 *
 * Mientras la fase 2 no está, el botón "I'm interested" hace mailto a los owners.
 */

import Link from "next/link";
import { resolveCourseImage, buildOwnersOutlookCompose } from "../lib/config";
import styles from "./CourseCard.module.css";

export default function CourseCard({ course }) {
  const imageSrc = resolveCourseImage(course.image_url);

  // "I'm interested" abre el composer web de Outlook con los 3 owners en
  // destinatario y el curso pre-rellenado. No depende del mail handler del SO.
  // Cuando Fase 2 esté lista, este href cambia a:
  //   `/login?next=/courses/${course.id}&intent=interest`
  const interestUrl = buildOwnersOutlookCompose(
    `Interested in: ${course.title}`,
    `Hi Veronica, Luznedy, and Hugo,\n\nI'd like to know more about the course "${course.title}" (code: ${course.code}).\n\nThank you,\n`
  );

  return (
    <article className={styles.card} aria-labelledby={`course-${course.id}-title`}>
      <div className={styles.imageWrapper}>
        {/* Usamos <img> nativo (no next/image) para soportar paths arbitrarios
            sin tener que pre-configurar remotePatterns en next.config */}
        <img
          src={imageSrc}
          alt={course.title}
          className={styles.image}
          loading="lazy"
        />
      </div>

      <div className={styles.body}>
        <span className={styles.code}>{course.code}</span>
        <h3 id={`course-${course.id}-title`} className={styles.title}>
          {course.title}
        </h3>

        {course.description && (
          <p className={styles.desc}>
            {course.description.length > 140
              ? course.description.slice(0, 140).trimEnd() + "…"
              : course.description}
          </p>
        )}

        <div className={styles.actions}>
          <Link href={`/courses/${course.id}`} className="btn-ghost">
            View More
          </Link>
          <a
            href={interestUrl}
            className="btn-primary"
            target="_blank"
            rel="noopener noreferrer"
          >
            I&apos;m Interested
          </a>
        </div>
      </div>
    </article>
  );
}
