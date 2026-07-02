"use client";

/**
 * MoodleLaunchClient — resuelve el SSO de Moodle y redirige al destino.
 * Lee ?to=<url de curso> (validado contra el propio Moodle, anti open-redirect),
 * pide una loginurl SSO de un solo uso y navega a ella con wantsurl. El token JWT
 * vive en localStorage, así que funciona también en pestañas nuevas.
 */

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { startTraining } from "../../lib/api";
import { MOODLE_URL } from "../../lib/config";
import { useT } from "../../i18n/client";
import styles from "./page.module.css";

export default function MoodleLaunchClient() {
  const t = useT("moodleLaunch");
  const params = useSearchParams();
  const [error, setError] = useState(false);
  const started = useRef(false);

  const to = params.get("to") || "";
  // Solo permitimos destinos dentro del propio Moodle (evita open-redirect).
  const safeTo = to && to.startsWith(MOODLE_URL) ? to : "";

  useEffect(() => {
    if (started.current) return; // evita doble ejecución (StrictMode/rerenders)
    started.current = true;
    startTraining(safeTo || undefined)
      .then((url) => {
        if (url) window.location.replace(url);
        else setError(true);
      })
      .catch(() => setError(true));
  }, [safeTo]);

  return (
    <main className={styles.wrap}>
      {!error ? (
        <p className={styles.msg} role="status">
          {t("loading")}
        </p>
      ) : (
        <div className={styles.box}>
          <p className={styles.msg}>{t("error")}</p>
          {safeTo && (
            <a className="btn-ghost" href={safeTo}>
              {t("openManually")}
            </a>
          )}
          <Link className={styles.back} href="/">
            {t("back")}
          </Link>
        </div>
      )}
    </main>
  );
}
