"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getDashboardCourses, startTraining, getMenu } from "../../lib/api";
import { isAuthenticated } from "../../lib/session";
import { useT } from "../../i18n/client";
import styles from "./dashboard.module.css";

export default function DashboardClient() {
  const t = useT("dashboard");
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [courses, setCourses] = useState([]);
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
      window.location.href = url;
    } catch (err) {
      setTrainError(t("trainError"));
      setTraining(false);
    }
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
        {courses.length === 0 ? (
          <p className={styles.cardBody}>{t("empty")}</p>
        ) : (
          <ul className={styles.courseList}>
            {courses.map((c) => (
              <li key={c.id} className={styles.courseItem}>
                <a className={styles.courseName} href={c.url} target="_blank" rel="noopener noreferrer">
                  {c.name}
                </a>
                {c.progress != null && (
                  <span className={styles.progress}>
                    {t("progress")}: {Math.round(c.progress)}%
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {menu.length > 0 && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>{t("menuTitle")}</h2>
          <ul className={styles.menuList}>
            {menu.map((item) => (
              <li key={item.url} className={styles.menuItem}>
                <a className={styles.menuLink} href={`/${item.url.replace(/^\//, "")}`}>
                  {item.title}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
