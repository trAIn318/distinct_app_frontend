"use client";

/**
 * Reveal — scroll-triggered entrance animation.
 *
 * Modos:
 *   <Reveal>…</Reveal>                  → el propio wrapper hace fade-up al entrar en viewport
 *   <Reveal group className={grid}>…    → el wrapper es el contenedor (p.ej. un grid) y sus
 *                                          hijos directos hacen fade-up escalonado (stagger)
 *
 * Props:
 *   as        — etiqueta a renderizar (default "div")
 *   delay     — retraso extra en ms (solo modo simple)
 *   group     — activa el modo stagger sobre los hijos directos
 *   className — clases adicionales (el wrapper puede SER el grid/section)
 *
 * Respeta prefers-reduced-motion: el contenido aparece sin animación.
 * El estilo vive en styles/global.css (.reveal / .reveal-group).
 */

import { useEffect, useRef } from "react";

export default function Reveal({
  children,
  as: Tag = "div",
  delay = 0,
  group = false,
  className = "",
  ...rest
}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion || typeof IntersectionObserver === "undefined") {
      el.classList.add("is-visible");
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            el.classList.add("is-visible");
            io.unobserve(el);
          }
        });
      },
      { threshold: 0, rootMargin: "0px 0px -10% 0px" }
    );

    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={`${group ? "reveal-group" : "reveal"}${className ? ` ${className}` : ""}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      {...rest}
    >
      {children}
    </Tag>
  );
}
