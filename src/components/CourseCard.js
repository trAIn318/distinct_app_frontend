"use client";

/**
 * CourseCard
 * Renderiza un curso individual. Client component (usa el contexto i18n)
 * para poder vivir dentro del CoursesExplorer interactivo.
 *
 * - Título/descripción: en el idioma de la UI (traducciones cacheadas en BD).
 * - Badge de idioma original: idioma en que SE DICTA el curso (independiente
 *   del idioma de la UI).
 */

import Link from "next/link";
import { resolveCourseImage } from "../lib/config";
import ContactOwnersButton from "./ContactOwnersButton";
import { getCourseTitle, getCourseDescription } from "../lib/courseText";
import { useT, useLocale } from "../i18n/client";
import styles from "./CourseCard.module.css";

export default function CourseCard({ course }) {
  const t = useT("card");
  const locale = useLocale();

  const imageSrc = resolveCourseImage(course.image_url);
  const title = getCourseTitle(course, locale);
  const description = getCourseDescription(course, locale);
  const origLang = (course.original_language || "").toLowerCase();

  // "I'm interested" deja que la persona elija con qué correo escribir (su
  // propia app, Gmail u Outlook), con los 3 owners en destinatario y el curso
  // pre-rellenado. El cuerpo va en inglés — los owners operan en inglés; se
  // usa el título original para que reconozcan de qué curso se trata.
  const interes = {
    subject: `Interested in: ${course.title}`,
    body: `Hi Veronica, Luznedy, and Hugo,\n\nI'd like to know more about the course "${course.title}" (code: ${course.code}).\n\nThank you,\n`,
  };

  return (
    <article className={styles.card} aria-labelledby={`course-${course.id}-title`}>
      <div className={styles.imageWrapper}>
        {/* Usamos <img> nativo (no next/image) para soportar paths arbitrarios
            sin tener que pre-configurar remotePatterns en next.config */}
        <img
          src={imageSrc}
          alt={title}
          className={styles.image}
          loading="lazy"
        />
        {origLang && (
          <span
            className={styles.langBadge}
            title={t("taughtIn", { lang: t(`lang.${origLang}`) })}
          >
            {t(`lang.${origLang}`)}
          </span>
        )}
      </div>

      <div className={styles.body}>
        <span className={styles.code}>{course.code}</span>
        <h3 id={`course-${course.id}-title`} className={styles.title}>
          {title}
        </h3>

        {description && (
          <p className={styles.desc}>
            {description.length > 140
              ? description.slice(0, 140).trimEnd() + "…"
              : description}
          </p>
        )}

        <div className={styles.actions}>
          <Link href={`/courses/${course.id}`} className="btn-ghost">
            {t("viewMore")}
          </Link>
          <ContactOwnersButton
            {...interes}
            label={t("interested")}
            className="btn-primary"
          />
        </div>
      </div>
    </article>
  );
}
