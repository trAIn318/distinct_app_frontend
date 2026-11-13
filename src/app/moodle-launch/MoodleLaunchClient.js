"use client";

/**
 * MoodleLaunchClient — resuelve el SSO de Moodle y redirige al destino.
 * Lee ?to=<url de curso> (validado contra el propio Moodle, anti open-redirect),
 * pide una loginurl SSO de un solo uso y navega a ella con wantsurl. El token JWT
 * vive en localStorage, así que funciona también en pestañas nuevas.
 *
 * ES LA SEGUNDA PUERTA DEL 402 POR MEMBRESÍA (la primera es la lista de cursos
 * del Tablero), y por eso el fallo no es un booleano: un 402 aquí no es un
 * problema de Moodle, y "no pudimos iniciar tu sesión" le echaría la culpa a
 * Moodle delante de alguien que lo que necesita es la membresía (o arreglar la
 * suscripción que ya le cobran). Se reconoce por el BOOLEANO
 * `membership_required` del cuerpo, nunca por el texto, y se ofrece lo mismo
 * que ofrece el Tablero. En ese caso NO se pinta "abrir el curso": sin
 * matrícula, ese enlace lleva a una página de Moodle que no entrega nada.
 */

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { startTraining } from "../../lib/api";
import { MOODLE_URL } from "../../lib/config";
import { useT } from "../../i18n/client";
import styles from "./page.module.css";

/** La ruta de la pantalla de pagos, la misma para las tres audiencias. */
const RUTA_PAGOS = "/dashboard/pay";

/** El motivo de corte en el que NO se puede decir "paga": ya hay una
 *  suscripción cobrándose que no es esta membresía. Llega en
 *  `estado_suscripcion` del cuerpo del 402. */
const PLAN_AJENO = "plan_ajeno";

export default function MoodleLaunchClient() {
  const t = useT("moodleLaunch");
  const tPay = useT("pay");
  const params = useSearchParams();
  // null = todavía en curso. {membresia: null} = fallo normal.
  // {membresia: {estado}} = el 402 por membresía.
  const [fallo, setFallo] = useState(null);
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
        else setFallo({ membresia: null });
      })
      .catch((err) => setFallo({
        membresia: err && err.membershipRequired === true
          ? { estado: err.estadoSuscripcion ?? null } : null,
      }));
  }, [safeTo]);

  if (!fallo) {
    return (
      <main className={styles.wrap}>
        <p className={styles.msg} role="status">{t("loading")}</p>
      </main>
    );
  }

  if (fallo.membresia) {
    const ajeno = fallo.membresia.estado === PLAN_AJENO;
    return (
      <main className={styles.wrap}>
        <div className={styles.box}>
          <p className={styles.msg}>
            {ajeno ? tPay("membership.cutoff.otherPlan") : tPay("membership.cutoff.needed")}
          </p>
          <a className="btn-primary" href={RUTA_PAGOS}>
            {ajeno ? tPay("membership.cutoff.ctaManage") : tPay("membership.cutoff.cta")}
          </a>
          <Link className={styles.back} href="/">{t("back")}</Link>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.wrap}>
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
    </main>
  );
}
