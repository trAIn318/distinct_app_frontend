"use client";

/**
 * DashboardMenu — el "Tablero" como panel deslizante desde la derecha.
 * Muestra progreso de cursos (miniatura + nombre + barra), el botón Entrenar
 * (SSO a Moodle) y los accesos secundarios del grupo DASHBOARD (Eval/Pay).
 * Carga los cursos la primera vez que se abre. Se abre también por el evento
 * `distinct:open-dashboard` (que dispara el redirect de /dashboard).
 */

import { useCallback, useEffect, useState } from "react";
import NavDrawer from "./NavDrawer";
import { getDashboardCourses, startTraining } from "../lib/api";
import { splitMenuByGroup, resolveMenuTarget } from "../lib/menuTargets";
import { resolveCourseImage } from "../lib/config";
import { useT } from "../i18n/client";
import styles from "./DashboardMenu.module.css";

const COURSE_IMAGE_FALLBACK = "/img/courses/under_construction.jpg";

export default function DashboardMenu({ menu = [] }) {
  const t = useT("dashboard");
  const [open, setOpen] = useState(false);
  const [courses, setCourses] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [training, setTraining] = useState(false);
  const [trainError, setTrainError] = useState(null);

  const load = useCallback(() => {
    if (loaded) return;
    setLoaded(true);
    getDashboardCourses().then((d) => setCourses(d.courses || []));
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

  const extraLinks = splitMenuByGroup(menu).dashboard.filter(
    (it) => resolveMenuTarget(it.url).type === "route"
  );

  return (
    <NavDrawer
      open={open}
      onOpenChange={handleOpenChange}
      label={t("title")}
      title={t("title")}
      width="min(520px, 94vw)"
      triggerClassName={styles.trigger}
      trigger={<span>{t("title")}</span>}
      headerActions={
        extraLinks.length > 0 ? (
          <ul className={styles.headerLinks}>
            {extraLinks.map((it) => (
              <li key={it.url}>
                <a className={styles.link} href={resolveMenuTarget(it.url).href}>
                  {it.title}
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
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className={styles.courseThumbWrap}>
                      <img
                        className={styles.courseThumb}
                        src={resolveCourseImage(c.image)}
                        alt={c.name}
                        loading="lazy"
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

        <button
          type="button"
          className="btn-primary"
          onClick={handleTrain}
          disabled={training}
        >
          {training ? t("trainLoading") : t("trainCta")}
        </button>
        {trainError && (
          <div className={styles.error} role="alert">{trainError}</div>
        )}
      </div>
    </NavDrawer>
  );
}
