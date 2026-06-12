"use client";

/**
 * ScrollRail — riel de progreso lateral para la Home.
 *
 * Una línea vertical fija al lado izquierdo que se va llenando de dorado
 * a medida que el usuario baja, con un punto por sección:
 *   - El punto se "enciende" cuando el scroll pasa por su sección.
 *   - Hover  → muestra la etiqueta de la sección.
 *   - Click  → scroll suave hasta esa sección.
 *
 * Detecta las secciones del DOM (`main > section`) después de montar,
 * así que funciona aunque alguna sección condicional no se renderice
 * (p.ej. FeaturedCourses cuando el backend no responde).
 *
 * Solo desktop (se oculta vía CSS bajo 1024px). Respeta reduced-motion.
 */

import { useEffect, useRef, useState } from "react";
import { useT } from "../i18n/client";
import styles from "./ScrollRail.module.css";

/** Clave de traducción (namespace "rail") por id de heading de cada sección. */
const SECTION_LABEL_KEYS = {
  "hero-heading": "home",
  "value-prop-heading": "getInTouch",
  "problem-approach-heading": "problem",
  "featured-courses-heading": "courses",
  "testimonials-heading": "testimonials",
  "platform-overview-heading": "platform",
  "how-it-works-heading": "howItWorks",
  "aria-feature-heading": "aria",
  "contact-heading": "contact",
  "partners-heading": "partners",
};

export default function ScrollRail() {
  const t = useT("rail");
  const [sections, setSections] = useState([]); // [{ label }]
  const [activeIndex, setActiveIndex] = useState(0);
  const [progress, setProgress] = useState(0); // 0..1 — llenado de la línea
  const nodesRef = useRef([]); // elementos <section> reales
  const rafRef = useRef(0);

  useEffect(() => {
    const els = Array.from(document.querySelectorAll("main > section"));
    if (els.length < 2) return;

    nodesRef.current = els;
    setSections(
      els.map((el, i) => ({
        labelKey: SECTION_LABEL_KEYS[el.getAttribute("aria-labelledby")] || null,
        index: i,
      }))
    );

    const update = () => {
      rafRef.current = 0;
      const list = nodesRef.current;
      const n = list.length;
      if (n < 2) return;

      // Punto de referencia: 45% del viewport
      const refY = window.innerHeight * 0.45;

      // Progreso continuo entre secciones: índice + fracción dentro del tramo
      let idx = 0;
      for (let i = 0; i < n; i++) {
        if (list[i].getBoundingClientRect().top <= refY) idx = i;
      }

      let frac = 0;
      if (idx < n - 1) {
        const top = list[idx].getBoundingClientRect().top;
        const next = list[idx + 1].getBoundingClientRect().top;
        const span = next - top;
        if (span > 0) frac = Math.min(Math.max((refY - top) / span, 0), 1);
      } else {
        // Última sección: completar con el final del documento
        const doc = document.documentElement;
        const remaining = doc.scrollHeight - window.scrollY - window.innerHeight;
        frac = remaining <= 8 ? 1 : 0;
      }

      setActiveIndex(idx);
      setProgress(Math.min((idx + frac) / (n - 1), 1));
    };

    const onScroll = () => {
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(update);
      }
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const goTo = (index) => {
    const el = nodesRef.current[index];
    if (!el) return;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    el.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
  };

  if (sections.length < 2) return null;

  return (
    <nav className={styles.rail} aria-label="Page sections">
      <div className={styles.track} aria-hidden="true">
        <div
          className={styles.fill}
          style={{ height: `${progress * 100}%` }}
        />
      </div>

      <ul className={styles.dots}>
        {sections.map((s, i) => {
          const passed = i <= activeIndex;
          const isCurrent = i === activeIndex;
          const label = s.labelKey ? t(s.labelKey) : t("section", { n: i + 1 });
          return (
            <li key={i} className={styles.dotItem}>
              <button
                type="button"
                onClick={() => goTo(i)}
                className={`${styles.dot} ${passed ? styles.dotPassed : ""} ${
                  isCurrent ? styles.dotCurrent : ""
                }`}
                aria-label={t("goTo", { label })}
                aria-current={isCurrent ? "true" : undefined}
              >
                <span className={styles.dotLabel}>{label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
