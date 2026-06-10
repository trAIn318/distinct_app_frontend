import Link from "next/link";
import { notFound } from "next/navigation";
import { getCourse, getReviews } from "../../../lib/api";
import {
  MOODLE_URL,
  resolveCourseImage,
  buildOwnersOutlookCompose,
} from "../../../lib/config";
import TestimonialsCarousel from "../../../components/TestimonialsCarousel";
import styles from "./page.module.css";

export async function generateMetadata({ params }) {
  const { id } = await params;
  const course = await getCourse(id);
  if (!course) {
    return { title: "Course not found | Distinct Hospitality Solutions" };
  }
  return {
    title: `${course.title} | Distinct Hospitality Solutions`,
    description: course.description?.slice(0, 160) || undefined,
  };
}

/**
 * Extrae el ID de YouTube de cualquier formato de URL (youtu.be, watch?v=, embed/…)
 * y devuelve la URL de embed lista para iframe.
 */
function toYouTubeEmbed(url) {
  if (!url) return null;
  const trimmed = url.trim();
  // youtu.be/<id>
  const shortMatch = trimmed.match(/youtu\.be\/([^?&/]+)/);
  if (shortMatch) return `https://www.youtube.com/embed/${shortMatch[1]}`;
  // youtube.com/watch?v=<id>
  const watchMatch = trimmed.match(/[?&]v=([^&]+)/);
  if (watchMatch) return `https://www.youtube.com/embed/${watchMatch[1]}`;
  // youtube.com/embed/<id> — ya está en formato embed
  if (trimmed.includes("/embed/")) return trimmed;
  return null;
}

export default async function CourseDetailPage({ params }) {
  const { id } = await params;
  const course = await getCourse(id);

  if (!course) {
    notFound();
  }

  // Testimonios: hoy son generales (no hay vínculo por curso en la tabla).
  // Si más adelante se agrega `mcourse_id` a `testimonials`, aquí se filtra.
  const testimonials = await getReviews({ limit: 8 }).catch(() => []);

  const imageSrc = resolveCourseImage(course.image_url);
  const videoEmbed = toYouTubeEmbed(course.video_url);

  const interestUrl = buildOwnersOutlookCompose(
    `Interested in: ${course.title}`,
    `Hi Veronica, Luznedy, and Hugo,\n\nI'd like to know more about the course "${course.title}" (code: ${course.code}).\n\nThank you,\n`
  );

  const payUrl = buildOwnersOutlookCompose(
    `Enrollment & Payment — ${course.title}`,
    `Hi Veronica, Luznedy, and Hugo,\n\nI'd like to enroll and arrange payment for the course "${course.title}" (code: ${course.code}).\n\nPlease let me know the next steps.\n\nThank you,\n`
  );

  return (
    <div className={styles.page}>
      {/* Breadcrumb */}
      <div className={`container ${styles.breadcrumbWrapper}`}>
        <Link href="/courses" className={styles.breadcrumb}>
          ← All Courses
        </Link>
      </div>

      {/* Hero del curso */}
      <section className={styles.hero} aria-labelledby="course-title">
        <div className={`container ${styles.heroGrid}`}>
          <div className={styles.heroCopy}>
            <span className={styles.code}>{course.code}</span>
            <h1 id="course-title" className={styles.title}>
              {course.title}
            </h1>

            {course.modules > 0 && (
              <p className={styles.meta}>
                <span className={styles.metaLabel}>Modules</span>
                <span className={styles.metaValue}>{course.modules}</span>
              </p>
            )}

            <div className={styles.actions}>
              <a
                href={payUrl}
                className="btn-primary"
                target="_blank"
                rel="noopener noreferrer"
              >
                Enroll & Pay
              </a>
              <a
                href={interestUrl}
                className="btn-ghost"
                target="_blank"
                rel="noopener noreferrer"
              >
                I&apos;m Interested
              </a>
              <a
                href={MOODLE_URL}
                className="btn-white"
                target="_blank"
                rel="noopener noreferrer"
              >
                Access Moodle
              </a>
            </div>
          </div>

          <div className={styles.heroImageWrapper}>
            <img
              src={imageSrc}
              alt={course.title}
              className={styles.heroImage}
            />
          </div>
        </div>
      </section>

      {/* Descripción */}
      {course.description && (
        <section className={styles.section} aria-labelledby="course-overview">
          <div className="container">
            <h2 id="course-overview" className={styles.sectionHeadline}>
              Overview
            </h2>
            <p className={styles.body}>{course.description}</p>
          </div>
        </section>
      )}

      {/* Video preview (si hay YouTube) */}
      {videoEmbed && (
        <section className={styles.section} aria-labelledby="course-preview">
          <div className="container">
            <h2 id="course-preview" className={styles.sectionHeadline}>
              Preview
            </h2>
            <div className={styles.videoWrapper}>
              <iframe
                src={videoEmbed}
                title={`${course.title} — Preview`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className={styles.videoFrame}
              />
            </div>
          </div>
        </section>
      )}

      {/* Testimonios rotando */}
      <TestimonialsCarousel
        testimonials={testimonials}
        eyebrow="What our learners say"
        title="Voices from the Floor"
      />

      {/* Footer CTA */}
      <section className={styles.footerCta}>
        <div className="container">
          <h2 className={styles.footerHeadline}>
            Ready to bring this training to your team?
          </h2>
          <p className={styles.footerCopy}>
            Reach out and our team will walk you through enrollment, pricing,
            and rollout.
          </p>
          <div className={styles.actions}>
            <a
              href={payUrl}
              className="btn-primary"
              target="_blank"
              rel="noopener noreferrer"
            >
              Enroll & Pay
            </a>
            <a
              href={interestUrl}
              className="btn-ghost"
              target="_blank"
              rel="noopener noreferrer"
            >
              I&apos;m Interested
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
