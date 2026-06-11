"use client";

/**
 * GoldenThread — lazo dorado que se dibuja en el fondo de la Home.
 *
 * Un path SVG serpenteante recorre toda la página por detrás del contenido
 * (z-index negativo). A medida que el usuario baja, el trazo se va dibujando
 * (técnica stroke-dasharray / stroke-dashoffset) con una punta luminosa que
 * acompaña el scroll.
 *
 * - El path se genera dinámicamente a partir de las posiciones reales de las
 *   secciones (alterna izquierda/derecha entre ellas), así que se adapta a
 *   cualquier viewport o contenido.
 * - Las secciones con fondo charcoal (ValuePropBar, ARIA, Contact) tapan el
 *   hilo de forma natural: el lazo parece pasar "por debajo" de esos paneles.
 * - Se reconstruye con ResizeObserver (imágenes que cargan, resize, etc.).
 * - Con prefers-reduced-motion el trazo se muestra completo y estático.
 * - Oculto en pantallas pequeñas vía CSS.
 */

import { useEffect, useRef } from "react";
import styles from "./GoldenThread.module.css";

export default function GoldenThread() {
  const svgRef = useRef(null);
  const glowRef = useRef(null);
  const lineRef = useRef(null);
  const tipRef = useRef(null);
  const stateRef = useRef({ len: 0, startY: 0, endY: 0 });
  const rafRef = useRef(0);

  useEffect(() => {
    const main = document.querySelector("main");
    const svg = svgRef.current;
    const glow = glowRef.current;
    const line = lineRef.current;
    const tip = tipRef.current;
    if (!main || !svg || !line) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const mainTopAbs = () => main.getBoundingClientRect().top + window.scrollY;

    /** Reconstruye el path a partir de las secciones reales. */
    const build = () => {
      const sections = Array.from(main.querySelectorAll(":scope > section"));
      if (sections.length < 3) return;

      const top = mainTopAbs();
      const W = main.clientWidth;
      const H = main.scrollHeight;
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
      svg.style.height = `${H}px`;

      // Punto de partida: centro, al final del hero (continúa su línea estática)
      const hero = sections[0].getBoundingClientRect();
      const startY = hero.bottom + window.scrollY - top - 60;
      const pts = [[W / 2, startY]];

      // Un ancla por sección siguiente, alternando lados del centro
      const sway = [0.34, 0.66];
      sections.slice(1).forEach((s, i) => {
        const r = s.getBoundingClientRect();
        const yMid = r.top + window.scrollY - top + r.height / 2;
        pts.push([W * sway[i % 2], yMid]);
      });

      // Cierre: vuelve al centro al final de la página
      pts.push([W / 2, H - 40]);

      // Curva suave (cúbicas con tangentes verticales → siempre desciende)
      let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
      for (let i = 1; i < pts.length; i++) {
        const [, y0] = pts[i - 1];
        const [x0] = pts[i - 1];
        const [x1, y1] = pts[i];
        const c = (y1 - y0) * 0.55;
        d += ` C ${x0.toFixed(1)} ${(y0 + c).toFixed(1)}, ${x1.toFixed(1)} ${(y1 - c).toFixed(1)}, ${x1.toFixed(1)} ${y1.toFixed(1)}`;
      }

      glow.setAttribute("d", d);
      line.setAttribute("d", d);

      const len = line.getTotalLength();
      stateRef.current = { len, startY, endY: H - 40 };

      if (reduceMotion) {
        // Trazo completo y estático
        glow.style.strokeDasharray = "none";
        line.style.strokeDasharray = "none";
        if (tip) tip.style.opacity = "0";
        return;
      }

      glow.style.strokeDasharray = `${len}`;
      line.style.strokeDasharray = `${len}`;
      update();
    };

    /**
     * Busca (binaria) la longitud del path cuya Y coincide con el punto de
     * referencia del viewport — la Y del path es monótona creciente.
     */
    const lengthAtY = (targetY) => {
      const { len } = stateRef.current;
      let lo = 0;
      let hi = len;
      for (let i = 0; i < 18; i++) {
        const mid = (lo + hi) / 2;
        if (line.getPointAtLength(mid).y < targetY) lo = mid;
        else hi = mid;
      }
      return (lo + hi) / 2;
    };

    const update = () => {
      rafRef.current = 0;
      const { len, startY, endY } = stateRef.current;
      if (!len || reduceMotion) return;

      const refY =
        window.scrollY + window.innerHeight * 0.6 - mainTopAbs();

      let drawn;
      if (refY <= startY) {
        drawn = 0;
      } else if (refY >= endY) {
        drawn = len;
      } else {
        drawn = lengthAtY(refY);
      }

      glow.style.strokeDashoffset = `${len - drawn}`;
      line.style.strokeDashoffset = `${len - drawn}`;

      if (tip) {
        if (drawn > 0 && drawn < len) {
          const p = line.getPointAtLength(drawn);
          tip.setAttribute("cx", p.x.toFixed(1));
          tip.setAttribute("cy", p.y.toFixed(1));
          tip.style.opacity = "1";
        } else {
          tip.style.opacity = "0";
        }
      }
    };

    const onScroll = () => {
      if (!rafRef.current) rafRef.current = requestAnimationFrame(update);
    };

    build();

    // Rebuild cuando cambia el alto del contenido (imágenes, resize…)
    let buildTimer = 0;
    const ro = new ResizeObserver(() => {
      clearTimeout(buildTimer);
      buildTimer = setTimeout(build, 150);
    });
    ro.observe(main);

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      ro.disconnect();
      clearTimeout(buildTimer);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div className={styles.wrapper} aria-hidden="true">
      <svg
        ref={svgRef}
        className={styles.svg}
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Halo suave bajo la línea principal */}
        <path ref={glowRef} className={styles.glow} fill="none" />
        {/* Línea principal */}
        <path ref={lineRef} className={styles.line} fill="none" />
        {/* Punta luminosa que acompaña el scroll */}
        <circle ref={tipRef} className={styles.tip} r="3.5" />
      </svg>
    </div>
  );
}
