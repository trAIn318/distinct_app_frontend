"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getDashboardCourses, startTraining, getMenu } from "../../lib/api";
import { resolveCourseImage } from "../../lib/config";
import { isAuthenticated } from "../../lib/session";

const COURSE_IMAGE_FALLBACK = "/img/courses/under_construction.jpg";
import { useT } from "../../i18n/client";
import styles from "./dashboard.module.css";

// Mapeo de las opciones de menú (page de la BD compartida, en formato de la app
// vieja) a su comportamiento en el frontend nuevo. Lo que no esté aquí cae a
// /coming-soon (En construcción) en vez de dar 404. NO tocamos roles_menu/menu:
// son tablas compartidas con la app antigua (rol 3 = 74 usuarios).
const MENU_TARGETS = {
  "dashboard/dash": { type: "route", href: "/dashboard" },
  "dashboard/trainy": { type: "train" },
  "settings/language": { type: "settings" },
};

function resolveMenuTarget(url) {
  const key = (url || "").replace(/^\//, "");
  return MENU_TARGETS[key] || { type: "route", href: "/coming-soon" };
}

export default function DashboardClient() {
  const t = useT("dashboard");
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [courses, setCourses] = useState(null);
  const [menu, setMenu] = useState([]);
  const [training, setTraining] = useState(false);
  const [trainError, setTrainError] = useState(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login?next=/dashboard");
      return;
    }
    setReady(true);
    getDashboardCourses().then((d) => setCourses(d.courses || []));
    getMenu().then(setMenu);
  }, [router]);

  if (!ready) return null;

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
    } catch (err) {
      setTrainError(t("trainError"));
      setTraining(false);
    }
  }

  function openSettings() {
    window.dispatchEvent(new Event("distinct:open-settings"));
  }

  return (
    <>
      <section className={styles.card}>
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
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>{t("coursesTitle")}</h2>
        {courses === null ? null : courses.length === 0 ? (
          <p className={styles.cardBody}>{t("empty")}</p>
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
                      {/* <img> nativo: la URL de Moodle es absoluta y pública */}
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
                            <span
                              className={styles.progressFill}
                              style={{ width: `${pct}%` }}
                            />
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
      </section>

      {menu.length > 0 && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>{t("menuTitle")}</h2>
          <ul className={styles.menuList}>
            {menu.map((item) => {
              const target = resolveMenuTarget(item.url);
              return (
                <li key={item.url} className={styles.menuItem}>
                  {target.type === "train" ? (
                    <button
                      type="button"
                      className={styles.menuLink}
                      onClick={handleTrain}
                      disabled={training}
                    >
                      {item.title}
                    </button>
                  ) : target.type === "settings" ? (
                    <button
                      type="button"
                      className={styles.menuLink}
                      onClick={openSettings}
                    >
                      {item.title}
                    </button>
                  ) : (
                    <a className={styles.menuLink} href={target.href}>
                      {item.title}
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
