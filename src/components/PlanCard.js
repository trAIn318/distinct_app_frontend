"use client";

/**
 * PlanCard — el plan de la compañía y lo que su administrador puede hacer.
 *
 * Todo lo que pinta viene de `GET /api/pay/mi-estado/`; la tarjeta no decide
 * reglas de negocio. Los estados, en el orden en que se evalúan:
 *   facturación apagada → sin plan → solo contacto → listo para pagar →
 *   suscripción viva (portal y, si hacen falta, cupos extra).
 *
 * DOS precios que NO son el mismo número: `precio_mensual_usd` de mi-estado es
 * el del PLAN; el de los cupos extra solo llega en la respuesta de
 * `POST /api/pay/cupos/` (`precio_cupos_usd`) y se imprime únicamente desde ahí.
 *
 * Contra el doble cobro, aquí hay dos defensas: el botón se desactiva mientras
 * la petición está en curso y un ref descarta un segundo envío del mismo tick
 * (un `submit` o el teclado ignoran `disabled`). El 409 del backend es la red
 * de seguridad, no la primera línea.
 */

import { useRef, useState } from "react";

import { abrirPortal, autorizarCupos, iniciarCheckout } from "../lib/api";
import { useLocale, useT } from "../i18n/client";
import ContactOwnersButton from "./ContactOwnersButton";
import styles from "../app/dashboard/pay/PayClient.module.css";

// Estados de Stripe en los que la suscripción cuenta como vigente. Mismo
// criterio que `ESTADOS_VIVOS` del backend: `past_due` sigue vivo porque Stripe
// reintenta el cobro. El backend lo reafirma (409), esto solo decide qué botones
// se ofrecen.
const ESTADOS_VIVOS = ["active", "trialing", "past_due"];

// Los dueños de la plataforma operan en inglés (mismo criterio que ValuePropBar).
const ASUNTO_ENTERPRISE = "Enterprise plan inquiry";

/** Clave i18n del error de una acción, por ESTADO y nunca por el texto del
 *  backend (que es prosa en español que no debe pintarse tal cual). */
function claveDeError(err) {
  const status = err && err.status;
  if (status === 409) return "errConflict";
  if (status === 401) return "errSession";
  if (status === 403) return "errForbidden";
  return "errGeneric";
}

export default function PlanCard({ estado, pagoRecibido = false, onRefresh }) {
  const t = useT("pay");
  const locale = useLocale();

  const ocupadoRef = useRef(false);
  const [enCurso, setEnCurso] = useState(null);   // null | "pay" | "portal" | "seats" | "refresh"
  const [fallo, setFallo] = useState(null);       // {accion, err}
  const [cupos, setCupos] = useState(null);       // {cupos_extra, precio_cupos_usd}

  /**
   * Corre una acción de una en una. `fn` devuelve true si navega fuera de la
   * página: en ese caso el botón se queda desactivado hasta que el navegador
   * se vaya, para que nadie lo pulse otra vez en ese intervalo.
   */
  async function ejecutar(accion, fn) {
    if (ocupadoRef.current) return;
    ocupadoRef.current = true;
    setEnCurso(accion);
    setFallo(null);
    try {
      const navega = await fn();
      if (navega) return;
    } catch (err) {
      setFallo({ accion, err });
    }
    ocupadoRef.current = false;
    setEnCurso(null);
  }

  async function irA(peticion) {
    const { url } = await peticion();
    window.location.href = url;
    return true;
  }

  const pagar = () => ejecutar("pay", () => irA(iniciarCheckout));
  const portal = () => ejecutar("portal", () => irA(abrirPortal));
  const revisar = () => ejecutar("refresh", async () => { await onRefresh(); });
  const autorizar = (total) => ejecutar("seats", async () => {
    // `total` es la cantidad TOTAL de cupos extra que se quiere, nunca la
    // diferencia con lo ya facturado: un reintento de red que repitiera "suma 3"
    // sumaría 6.
    setCupos(await autorizarCupos(total));
    await onRefresh();
  });

  if (!estado.facturacion_activa) {
    return (
      <section className={styles.card}>
        <p className={styles.muted}>{t("billingOff")}</p>
      </section>
    );
  }

  if (!estado.plan_code) {
    return (
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>{t("noPlanTitle")}</h2>
        <p className={styles.muted}>{t("noPlanBody")}</p>
      </section>
    );
  }

  const viva = ESTADOS_VIVOS.includes(estado.estado_suscripcion);
  const nombrePlan = t(`plans.${estado.plan_code}`) === `pay.plans.${estado.plan_code}`
    ? estado.plan_code
    : t(`plans.${estado.plan_code}`);
  const hayCupos = typeof estado.cupos_incluidos === "number";
  const extraNecesarios = hayCupos ? Math.max(0, estado.miembros - estado.cupos_incluidos) : 0;
  const faltanCupos = viva && hayCupos && extraNecesarios > estado.cupos_extra;
  const etiquetaEstado = viva
    ? (t(`statuses.${estado.estado_suscripcion}`))
    : estado.estado_suscripcion;
  const fin = estado.current_period_end
    ? new Date(estado.current_period_end).toLocaleDateString(locale, { dateStyle: "long" })
    : null;

  const errorDe = (accion) => (fallo && fallo.accion === accion ? t(claveDeError(fallo.err)) : null);
  const etiquetaPagar = fallo && fallo.accion === "pay"
    ? t("retry")
    : enCurso === "pay" ? t("redirecting") : t("pay");

  return (
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>{t("planTitle")}</h2>
      <p className={styles.planName}>{nombrePlan}</p>
      {typeof estado.precio_mensual_usd === "number" && (
        <p className={styles.data}>{t("pricePerMonth", { price: estado.precio_mensual_usd })}</p>
      )}
      <p className={styles.data}>{t("members", { count: estado.miembros })}</p>
      {hayCupos && <p className={styles.data}>{t("seatsIncluded", { count: estado.cupos_incluidos })}</p>}

      {estado.solo_contacto && (
        <div className={styles.block}>
          <p className={styles.muted}>{t("enterpriseBody")}</p>
          <ContactOwnersButton subject={ASUNTO_ENTERPRISE} label={t("enterpriseContact")} className="btn-ghost" />
        </div>
      )}

      {estado.puede_pagar && (
        <div className={styles.block}>
          {estado.paga_implementacion && <p className={styles.muted}>{t("implementationFee")}</p>}
          {pagoRecibido ? (
            // El pago ya se hizo pero el webhook aún no lo reflejó: ofrecer
            // "Pagar" otra vez sería un segundo cobro.
            <button type="button" className="btn-ghost" onClick={revisar} disabled={enCurso !== null}>
              {t("checkAgain")}
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={pagar} disabled={enCurso !== null}>
              {etiquetaPagar}
            </button>
          )}
        </div>
      )}

      {estado.estado_suscripcion && (
        <div className={styles.block}>
          <p className={styles.data}>{t("statusLabel", { status: etiquetaEstado })}</p>
          {viva && fin && <p className={styles.data}>{t("renewsOn", { date: fin })}</p>}
          {viva && estado.tiene_portal && (
            <button type="button" className="btn-ghost" onClick={portal} disabled={enCurso !== null}>
              {enCurso === "portal" ? t("openingPortal") : t("manageBilling")}
            </button>
          )}
        </div>
      )}

      {faltanCupos && (
        <div className={styles.block}>
          <p className={styles.muted}>
            {t("seatsOver", { members: estado.miembros, extra: extraNecesarios })}
          </p>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => autorizar(extraNecesarios)}
            disabled={enCurso !== null}
          >
            {enCurso === "seats" ? t("authorizingSeats") : t("authorizeSeats", { count: extraNecesarios })}
          </button>
        </div>
      )}

      {cupos && (
        <p className={styles.notice} role="status">
          {t("seatsAuthorized", { count: cupos.cupos_extra })}{" "}
          {t("seatsCost", { price: cupos.precio_cupos_usd })}
        </p>
      )}

      {fallo && (
        <p className={styles.error} role="alert">{errorDe(fallo.accion)}</p>
      )}
    </section>
  );
}
