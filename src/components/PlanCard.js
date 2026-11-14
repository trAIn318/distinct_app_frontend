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
 * el del PLAN; el unitario de los cupos extra es `precio_cupo_extra_usd`, que
 * también llega en mi-estado para decir el monto ANTES de pedir la autorización.
 * Después de autorizar se confirma con `precio_cupos_usd`, de la respuesta de
 * `POST /api/pay/cupos/`.
 *
 * NINGÚN mensaje de error afirma nada sobre el cobro: un fallo de red no dice si
 * hubo o no cargo. Si la autorización de cupos se hizo y solo falló releer el
 * estado, se dice eso aparte y se conserva el aviso de éxito.
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
import styles from "./PlanCard.module.css";

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

/** El texto de una clave de un grupo i18n (plans, statuses) o, si no hay
 *  traducción, el valor tal cual lo mandó el backend. */
function traducido(t, grupo, valor) {
  const clave = `${grupo}.${valor}`;
  const texto = t(clave);
  return texto === `pay.${clave}` ? valor : texto;
}

/**
 * Elegir cuántos cupos extra se quieren EN TOTAL y ver su costo mensual antes
 * del clic que lo autoriza. Es un componente aparte para que su estado nazca
 * solo cuando el backend ofrece autorizar (PlanCard tiene retornos tempranos).
 *
 * Valor inicial: lo que hace falta si eso supera lo ya facturado; si no, uno más
 * que lo ya facturado (la compañía al tope que quiere crecer). El mínimo es lo
 * que dice el backend: menos que eso bloquearía las invitaciones igual.
 */
function AutorizarCupos({ estado, enCurso, onAutorizar, t }) {
  const necesarios = estado.cupos_extra_necesarios || 0;
  const facturados = estado.cupos_extra || 0;
  const [texto, setTexto] = useState(String(necesarios > facturados ? necesarios : facturados + 1));

  const total = /^\d+$/.test(texto) ? Number(texto) : null;
  // El maximo lo calcula el backend (misma cuenta que rechaza); sin el, no hay tope local.
  const maximo = typeof estado.cupos_extra_maximo === "number" ? estado.cupos_extra_maximo : null;
  const valido = total !== null && total >= necesarios && (maximo === null || total <= maximo);
  // Subir pide autorizar un cobro mayor; bajar o dejar igual no lo aumenta.
  const claveBase = total === null || total > facturados
    ? "authorizeSeats"
    : total < facturados ? "lowerSeats" : "keepSeats";
  // Con UN cupo, singular ("1 cupo extra", no "1 cupos extra").
  const claveBoton = total === 1 ? `${claveBase}One` : claveBase;
  const unitario = estado.precio_cupo_extra_usd;

  return (
    <div className={styles.block}>
      {necesarios > 0 ? (
        <p className={styles.muted}>
          {t("seatsOver", { members: estado.miembros, extra: necesarios })}
        </p>
      ) : (
        <p className={styles.muted}>
          {t("seatsAtCap", {
            members: estado.miembros,
            seats: (estado.cupos_incluidos ?? 0) + facturados,
          })}
        </p>
      )}
      <label className={styles.data} htmlFor="cupos-total">{t("seatsTotalLabel")}</label>
      <input
        id="cupos-total"
        className={styles.input}
        type="number"
        inputMode="numeric"
        min={necesarios}
        max={maximo ?? undefined}
        step={1}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        disabled={enCurso !== null}
      />
      {valido && typeof unitario === "number" && (
        <p className={styles.data}>
          {t(total === 1 ? "seatsPriceOne" : "seatsPrice", { count: total, unit: unitario, total: total * unitario })}
        </p>
      )}
      <p className={styles.muted}>{t("seatsHint")}</p>
      <button
        type="button"
        className="btn-ghost"
        onClick={() => onAutorizar(total)}
        disabled={enCurso !== null || !valido}
      >
        {enCurso === "seats" ? t("authorizingSeats") : t(claveBoton, { count: valido ? total : "" })}
      </button>
    </div>
  );
}

export default function PlanCard({ estado, pagoRecibido = false, onRefresh }) {
  const t = useT("pay");
  const locale = useLocale();

  const ocupadoRef = useRef(false);
  const [enCurso, setEnCurso] = useState(null);   // null | "pay" | "portal" | "seats" | "refresh"
  const [fallo, setFallo] = useState(null);       // {accion, err}
  const [cupos, setCupos] = useState(null);       // {cupos_extra, precio_cupos_usd}
  const [refrescoFallo, setRefrescoFallo] = useState(false);  // autorizó, pero no pudo releer

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
    setRefrescoFallo(false);
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
    // Sin url no hay a dónde ir: navegar a `undefined` dejaría al cliente en una
    // página rota con el botón desactivado para siempre.
    if (typeof url !== "string" || !url) throw new Error("La respuesta no trae url.");
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
    // Aquí la autorización YA se hizo (y se factura). Si releer el estado falla,
    // no es un fallo de la acción: se avisa aparte y se conserva el éxito.
    try {
      await onRefresh();
    } catch {
      setRefrescoFallo(true);
    }
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

  // Nada aquí interpreta estados de Stripe ni recalcula reglas: lo que se ofrece
  // lo dicen los booleanos del backend (puede_pagar, tiene_portal, solo_contacto,
  // puede_autorizar_cupos) y las cantidades de cupos también.
  const nombrePlan = traducido(t, "plans", estado.plan_code);
  const hayCupos = typeof estado.cupos_incluidos === "number";
  const etiquetaEstado = traducido(t, "statuses", estado.estado_suscripcion);
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
          {fin && <p className={styles.data}>{t("renewsOn", { date: fin })}</p>}
          {estado.tiene_portal && (
            <button type="button" className="btn-ghost" onClick={portal} disabled={enCurso !== null}>
              {enCurso === "portal" ? t("openingPortal") : t("manageBilling")}
            </button>
          )}
        </div>
      )}

      {estado.puede_autorizar_cupos && (
        <AutorizarCupos estado={estado} enCurso={enCurso} onAutorizar={autorizar} t={t} />
      )}

      {cupos && (
        <p className={styles.notice} role="status">
          {t(cupos.cupos_extra === 1 ? "seatsAuthorizedOne" : "seatsAuthorized",
             { count: cupos.cupos_extra })}{" "}
          {t("seatsCost", { price: cupos.precio_cupos_usd })}
        </p>
      )}

      {refrescoFallo && (
        <p className={styles.error} role="alert">{t("seatsRefreshFailed")}</p>
      )}

      {fallo && (
        <p className={styles.error} role="alert">{errorDe(fallo.accion)}</p>
      )}
    </section>
  );
}
