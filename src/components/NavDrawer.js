"use client";

/**
 * NavDrawer — cascarón controlado para paneles que se deslizan desde la derecha
 * (slide-over). El padre posee `open` y recibe `onOpenChange`. Este componente:
 *   - pinta el trigger (con aria-expanded/aria-haspopup),
 *   - muestra un backdrop oscuro (clic fuera cierra) y un panel lateral,
 *   - cierra con Escape, bloquea el scroll del body mientras está abierto,
 *   - gestiona el foco (al abrir enfoca el botón cerrar; al cerrar lo devuelve
 *     al trigger).
 * No sabe nada de cursos ni de settings — solo abre/cierra y ubica el panel.
 */

import { useEffect, useRef } from "react";
import styles from "./NavDrawer.module.css";

export default function NavDrawer({
  open,
  onOpenChange,
  label,
  title,
  headerActions,
  trigger,
  triggerClassName = "",
  width,
  children,
}) {
  const triggerRef = useRef(null);
  const closeRef = useRef(null);
  const wasOpen = useRef(false);

  // Escape para cerrar + bloqueo de scroll del body mientras está abierto
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onOpenChange]);

  // Foco: al abrir → botón cerrar; al cerrar (si estaba abierto) → trigger
  useEffect(() => {
    if (open) closeRef.current?.focus();
    else if (wasOpen.current) triggerRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.trigger} ${triggerClassName}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
        onClick={() => onOpenChange(!open)}
      >
        {trigger}
      </button>

      <div
        className={`${styles.backdrop} ${open ? styles.backdropOpen : ""}`}
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />

      <aside
        className={`${styles.panel} ${open ? styles.panelOpen : ""}`}
        style={width ? { width } : undefined}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        aria-hidden={!open}
        {...(!open ? { inert: "" } : {})}
      >
        <div className={styles.panelHeader}>
          <div className={styles.panelHeaderLeft}>
            {title && <h2 className={styles.panelTitle}>{title}</h2>}
            {headerActions}
          </div>
          <button
            ref={closeRef}
            type="button"
            className={styles.closeButton}
            onClick={() => onOpenChange(false)}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className={styles.panelBody}>{children}</div>
      </aside>
    </>
  );
}
