"use client";

/**
 * NavDropdown — cascarón controlado para desplegables de la barra.
 * El padre posee `open` y recibe `onOpenChange`. Este componente solo:
 *   - pinta el trigger (con aria-expanded/aria-haspopup),
 *   - cierra con Escape y clic-fuera,
 *   - coloca el panel (popover en escritorio, a lo ancho en móvil vía CSS).
 * No sabe nada de cursos ni de settings — solo abre/cierra y ubica el panel.
 */

import { useEffect, useRef } from "react";
import styles from "./NavDropdown.module.css";

export default function NavDropdown({
  open,
  onOpenChange,
  label,
  trigger,
  triggerClassName = "",
  align = "end",
  children,
}) {
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    const onClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open, onOpenChange]);

  return (
    <div ref={rootRef} className={styles.root}>
      <button
        type="button"
        className={`${styles.trigger} ${triggerClassName}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
        onClick={() => onOpenChange(!open)}
      >
        {trigger}
      </button>
      {open && (
        <div
          className={`${styles.panel} ${align === "start" ? styles.alignStart : styles.alignEnd}`}
          role="dialog"
          aria-label={label}
        >
          {children}
        </div>
      )}
    </div>
  );
}
