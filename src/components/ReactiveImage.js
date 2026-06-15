"use client";

/**
 * ReactiveImage — next/image con efecto duotono dorado → color + zoom sutil.
 * Resuelve estética Y rendimiento (AVIF/WebP, lazy-load, width/height → sin CLS).
 *
 * Todo parametrizable por props; los defaults visuales salen de tokens.css y
 * solo se sobreescriben cuando se pasa la prop (vía CSS custom properties inline).
 *
 *   trigger="hover"  → se revela al pasar el cursor (desktop)
 *   trigger="inview" → se revela al entrar en viewport (móvil/táctil)
 *   trigger="both"   → ambos (default)
 *
 * Respeta prefers-reduced-motion: imagen a color fija.
 */

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { motion } from "../lib/motion";
import styles from "./ReactiveImage.module.css";

const RATIO_DIMS = {
  "16:9": { width: 1600, height: 900 },
  "4:3": { width: 1200, height: 900 },
  "1:1": { width: 1000, height: 1000 },
};

export default function ReactiveImage({
  src,
  alt,
  ratio = "4:3",
  priority = false,
  effect = "duotone",
  tint,                 // override de --duotone-tint
  tintOpacity,          // override de --duotone-opacity
  zoom,                 // override de --reactive-zoom
  duration,             // override de --reactive-duration
  trigger = motion.reactive.trigger,
  sizes = "(max-width: 768px) 100vw, 33vw",
  className = "",
}) {
  const { width, height } = RATIO_DIMS[ratio] || RATIO_DIMS["4:3"];
  const [inView, setInView] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (effect === "none" || trigger === "hover") return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setInView(true);
            io.unobserve(el);
          }
        });
      },
      { threshold: 0.25 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [effect, trigger]);

  // Solo declaramos las custom properties que el usuario sobreescribe.
  const styleVars = {};
  if (tint) styleVars["--duotone-tint"] = tint;
  if (tintOpacity != null) styleVars["--duotone-opacity"] = String(tintOpacity);
  if (zoom != null) styleVars["--reactive-zoom"] = String(zoom);
  if (duration) styleVars["--reactive-duration"] = duration;

  return (
    <figure
      ref={ref}
      className={`${styles.frame} ${className}`}
      data-effect={effect}
      data-trigger={trigger}
      data-inview={inView ? "true" : "false"}
      style={styleVars}
    >
      <Image
        className={styles.img}
        src={src}
        alt={alt}
        width={width}
        height={height}
        sizes={sizes}
        priority={priority}
      />
    </figure>
  );
}
