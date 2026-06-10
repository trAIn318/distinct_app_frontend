"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./TestimonialsCarousel.module.css";

// Tiempos en ms
const BASE_INTERVAL = 3500;             // 3.5s auto-rotación normal
const POST_INTERACTION_INTERVAL = 5500;  // 5.5s tras click manual (más tiempo para leer)

/**
 * TestimonialsCarousel
 * Rota cada 3.5 s. Si el usuario navega manual (prev/next/dot), espera 5.5 s
 * antes de la siguiente rotación. NO pausa al hover.
 *
 * Props:
 *   testimonials: array de { id, name, role, company, content, rating, city }
 *   eyebrow?: string  (default "What our learners say")
 *   title?: string    (default "Voices from the Floor")
 */
export default function TestimonialsCarousel({
  testimonials = [],
  eyebrow = "What our learners say",
  title = "Voices from the Floor",
}) {
  const [index, setIndex] = useState(0);
  const [nextDelay, setNextDelay] = useState(BASE_INTERVAL);

  const count = testimonials.length;

  const advanceTo = useCallback(
    (nextIdx) => {
      setIndex(((nextIdx % count) + count) % count);
    },
    [count]
  );

  // Auto-rotación: cada vez que cambia index o nextDelay, se programa el
  // siguiente avance. Tras la rotación automática vuelve al delay base.
  useEffect(() => {
    if (count <= 1) return undefined;
    const id = setTimeout(() => {
      advanceTo(index + 1);
      setNextDelay(BASE_INTERVAL);
    }, nextDelay);
    return () => clearTimeout(id);
  }, [count, index, nextDelay, advanceTo]);

  // Acción manual del usuario: salta al testimonio elegido y extiende el
  // delay del próximo avance automático para que tenga tiempo de leer.
  const handleManual = useCallback(
    (nextIdx) => {
      advanceTo(nextIdx);
      setNextDelay(POST_INTERACTION_INTERVAL);
    },
    [advanceTo]
  );

  if (count === 0) return null;

  const t = testimonials[index];

  return (
    <section className={styles.section} aria-labelledby="testimonials-heading">
      <div className="container">
        <span className={styles.eyebrow}>{eyebrow}</span>
        <h2 id="testimonials-heading" className={styles.headline}>
          {title}
        </h2>

        <div className={styles.cardWrap}>
          {count > 1 && (
            <button
              type="button"
              className={`${styles.navBtn} ${styles.navPrev}`}
              onClick={() => handleManual(index - 1)}
              aria-label="Previous testimonial"
            >
              ←
            </button>
          )}

          <article
            key={t.id}
            className={styles.card}
            aria-live="polite"
            aria-atomic="true"
          >
            {t.rating ? (
              <div className={styles.stars} aria-label={`Rated ${t.rating} out of 5`}>
                {"★".repeat(t.rating)}
                <span className={styles.starsEmpty}>
                  {"★".repeat(Math.max(0, 5 - t.rating))}
                </span>
              </div>
            ) : null}

            <blockquote className={styles.quote}>
              <span className={styles.openMark} aria-hidden="true">
                &ldquo;
              </span>
              {t.content}
              <span className={styles.closeMark} aria-hidden="true">
                &rdquo;
              </span>
            </blockquote>

            <footer className={styles.attribution}>
              <span className={styles.name}>{t.name}</span>
              {(t.role || t.company) && (
                <span className={styles.meta}>
                  {[t.role, t.company].filter(Boolean).join(" · ")}
                  {t.city ? ` · ${t.city}` : ""}
                </span>
              )}
            </footer>
          </article>

          {count > 1 && (
            <button
              type="button"
              className={`${styles.navBtn} ${styles.navNext}`}
              onClick={() => handleManual(index + 1)}
              aria-label="Next testimonial"
            >
              →
            </button>
          )}
        </div>

        {count > 1 && (
          <div className={styles.dots} role="tablist" aria-label="Testimonial selector">
            {testimonials.map((tt, i) => (
              <button
                key={tt.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Show testimonial ${i + 1}`}
                className={`${styles.dot} ${i === index ? styles.dotActive : ""}`}
                onClick={() => handleManual(i)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
