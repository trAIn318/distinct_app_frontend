"use client";

/**
 * AnimatedCounter — cuenta de 0 hasta `value` al entrar en viewport.
 * Parametrizable: duración, easing, prefijo/sufijo.
 * Respeta prefers-reduced-motion (pinta el valor final sin animar).
 * Tipografía monoespaciada (--font-label): los números van en mono.
 */

import { useEffect, useRef, useState } from "react";
import { easings, motion, countAt, formatNumber } from "../lib/motion";
import styles from "./AnimatedCounter.module.css";

export default function AnimatedCounter({
  value,
  durationMs = motion.counter.durationMs,
  easing = motion.counter.easing,
  prefix = "",
  suffix = "",
  className = "",
}) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduce || typeof IntersectionObserver === "undefined") {
      setDisplay(value);
      return;
    }

    const easeFn = easings[easing] || easings.easeOutCubic;

    const start = (t0) => {
      const tick = (now) => {
        const progress = (now - t0) / durationMs;
        setDisplay(countAt(value, progress, easeFn));
        if (progress < 1) rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            start(performance.now());
            io.unobserve(el);
          }
        });
      },
      { threshold: 0.4 }
    );

    io.observe(el);
    return () => {
      io.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, durationMs, easing]);

  return (
    <span ref={ref} className={`${styles.counter} ${className}`}>
      {formatNumber(display, { prefix, suffix })}
    </span>
  );
}
