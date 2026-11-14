"use client";

/**
 * DashboardMenu — el "Tablero" como panel deslizante desde la derecha.
 * Muestra progreso de cursos (miniatura + nombre + barra), el botón Entrenar
 * (SSO a Moodle) y los accesos secundarios del grupo DASHBOARD (Eval/Pay).
 * Carga los cursos la primera vez que se abre. Se abre también por el evento
 * `distinct:open-dashboard` (que dispara el redirect de /dashboard).
 *
 * EL 402 POR MEMBRESÍA NO PUEDE PARECER "NO TIENES CURSOS". `/api/dashboard/
 * courses/` es best-effort: cualquier fallo vuelve como lista vacía, y eso aquí
 * se pinta como "todavía no tienes cursos". A quien le falta la membresía
 * individual eso le diría que no tiene nada en vez de ofrecerle comprarla, y a
 * quien tiene una suscripción ajena cobrándose le ocultaría el único sitio
 * donde puede arreglarlo. `getDashboardCourses` marca ese caso con
 * `membership_required` —el BOOLEANO del cuerpo, nunca el texto, que ya cambió
 * una vez— y aquí se pinta el aviso con su enlace a la pantalla de pagos.
 *
 * Con el corte puesto tampoco se ofrece Entrenar: el salto a Moodle devuelve el
 * MISMO 402 (sus dos puertas son esta lista y ese salto), así que el botón solo
 * llevaría a "el entrenamiento no está disponible", que es justo el mensaje que
 * no explica nada.
 */

import { useCallback, useEffect, useState } from "react";
import NavDrawer from "./NavDrawer";
import MenuIcon from "./MenuIcon";
import MembershipCutoff from "./MembershipCutoff";
import { getDashboardCourses, startTraining } from "../lib/api";
import { splitMenuByGroup, resolveMenuTarget, getMenuLabel } from "../lib/menuTargets";
import { resolveCourseImage } from "../lib/config";
import { useT } from "../i18n/client";
import styles from "./DashboardMenu.module.css";

const COURSE_IMAGE_FALLBACK = "/img/courses/under_construction.jpg";

export default function DashboardMenu({ menu = [] }) {
  const t = useT("dashboard");
  const tMenu = useT("menu");
  const [open, setOpen] = useState(false);
  const [courses, setCourses] = useState(null);
  const [membership, setMembership] = useState(null);  // null | {estado}
  const [loaded, setLoaded] = useState(false);
  const [training, setTraining] = useState(false);
  const [trainError, setTrainError] = useState(null);

  const load = useCallback(() => {
    if (loaded) return;
    setLoaded(true);
    getDashboardCourses().then((d) => {
      // Por el booleano del cuerpo, nunca por el texto del mensaje.
      setMembership(d && d.membership_required === true
        ? { estado: d.estado_suscripcion ?? null } : null);
      setCourses(d.courses || []);
    });
  }, [loaded]);

  useEffect(() => {
    const openMenu = () => {
      setOpen(true);
      load();
    };
    window.addEventListener("distinct:open-dashboard", openMenu);
    // Intento persistido (carga en frío de /dashboard): abrir tras el redirect,
    // cuando el listener aún no existía en el momento del dispatch.
    try {
      if (window.sessionStorage.getItem("distinct:open-dashboard")) {
        window.sessionStorage.removeItem("distinct:open-dashboard");
        openMenu();
      }
    } catch {}
    return () => window.removeEventListener("distinct:open-dashboard", openMenu);
  }, [load]);

  const handleOpenChange = (next) => {
    setOpen(next);
    if (next) load();
  };

  async function handleTrain() {
    setTrainError(null);
    setTraining(true);
    try {
      const url = await startTraining();
      if (!url) {
        setTrainError(t("trainError"));
        setTraining(false);
        return;
      }
      window.location.href = url;
    } catch {
      setTrainError(t("trainError"));
      setTraining(false);
    }
  }

  // Grupo DASHBOARD renderizado data-driven: cada opción sin pantalla propia
  // (Dash/Eval/Pay y futuras) se pinta como chip con su icono+título de la BD y
  // enlaza a /coming-soon. "Training" (trainy) es la única con acción propia (SSO)
  // y se muestra como botón, solo si el rol la tiene.
  const dashboardItems = splitMenuByGroup(menu).dashboard;
  const routeLinks = dashboardItems.filter(
    (it) => resolveMenuTarget(it.url).type === "route"
  );
  const hasTraining = dashboardItems.some(
    (it) => resolveMenuTarget(it.url).type === "train"
  );

  return (
    <NavDrawer
      open={open}
      onOpenChange={handleOpenChange}
      label={t("title")}
      title={t("title")}
      width="min(520px, 94vw)"
      triggerClassName={styles.trigger}
      trigger={
        <span className={styles.triggerInner}>
          <span>{t("title")}</span>
          {/* Chevron dorado: señala que es un desplegable (la rueda se explica
              sola, el Tablero no). Rota 180° al abrir. */}
          <svg className={styles.caret} viewBox="0 0 12 8" aria-hidden="true">
            <path d="M1 1.5 6 6.5 11 1.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      }
      headerActions={
        routeLinks.length > 0 ? (
          <ul className={styles.headerLinks}>
            {routeLinks.map((it) => (
              <li key={it.url}>
                <a className={styles.link} href={resolveMenuTarget(it.url).href}>
                  <MenuIcon icon={it.icon} className={styles.linkIcon} />
                  <span>{getMenuLabel(it, tMenu)}</span>
                </a>
              </li>
            ))}
          </ul>
        ) : null
      }
    >
      <div className={styles.panelInner}>
        <h2 className={styles.sectionTitle}>{t("coursesTitle")}</h2>

        {courses === null ? (
          <p className={styles.muted}>{t("loading")}</p>
        ) : membership ? (
          // El 402: hay algo que comprar (o que arreglar), no "no tienes cursos".
          <div className={styles.membership}>
            <MembershipCutoff
              estado={membership.estado}
              textClassName={styles.membershipText}
              ctaClassName={styles.membershipCta}
            />
          </div>
        ) : courses.length === 0 ? (
          <p className={styles.muted}>{t("empty")}</p>
        ) : (
          <ul className={styles.courseList}>
            {courses.map((c) => {
              const pct = c.progress != null ? Math.round(c.progress) : null;
              return (
                <li key={c.id} className={styles.courseItem}>
                  <a
                    className={styles.courseLink}
                    href={`/moodle-launch?to=${encodeURIComponent(c.url)}`}
                  >
                    <span className={styles.courseThumbWrap}>
                      <img
                        className={styles.courseThumb}
                        src={resolveCourseImage(c.image)}
                        alt={c.name}
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                          if (e.currentTarget.src.indexOf(COURSE_IMAGE_FALLBACK) === -1) {
                            e.currentTarget.src = COURSE_IMAGE_FALLBACK;
                          }
                        }}
                      />
                    </span>
                    <span className={styles.courseInfo}>
                      <span className={styles.courseName}>{c.name}</span>
                      {pct != null && (
                        <span className={styles.progressRow}>
                          <span className={styles.progressTrack}>
                            <span className={styles.progressFill} style={{ width: `${pct}%` }} />
                          </span>
                          <span className={styles.progressLabel}>{pct}%</span>
                        </span>
                      )}
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        )}

        {/* Con el corte puesto, Entrenar devuelve el mismo 402: ver la cabecera. */}
        {hasTraining && !membership && (
          <button
            type="button"
            className="btn-primary"
            onClick={handleTrain}
            disabled={training}
          >
            {training ? t("trainLoading") : t("trainCta")}
          </button>
        )}
        {trainError && (
          <div className={styles.error} role="alert">{trainError}</div>
        )}
      </div>
    </NavDrawer>
  );
}
