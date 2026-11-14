"use client";

/**
 * MembershipCard — la membresía individual de una persona (`soy: "individuo"`).
 *
 * Es la hermana de PlanCard y NO comparte ni un campo de cupos con ella: una
 * membresía es de una persona, no tiene asientos ni cuota de implementación
 * (esas son de empresa). Todo lo que pinta viene de `GET /api/pay/mi-estado/`
 * (`estado_de_persona`): `facturacion_activa`, `precio_mensual_usd`,
 * `estado_suscripcion`, `puede_pagar`, `tiene_portal` y
 * `cursos_en_el_catalogo`. Aquí no se recalcula ninguna regla de negocio.
 *
 * TRES COSAS QUE ESTA TARJETA EXISTE PARA NO DECIR:
 *
 * 1. **Un precio inventado.** `precio_mensual_usd` llega `null` cuando Stripe no
 *    respondió, y entonces no se ofrece pagar y se dice por qué. El backend no
 *    guarda un precio de respaldo a propósito: una pantalla sin precio es mejor
 *    que un precio que la tarjeta no va a cumplir.
 *
 * 2. **"Ya estás suscrito" a quien tiene el acceso cortado.** Caso medido: una
 *    suscripción viva creada a mano en Stripe con otro precio llega como
 *    `estado_suscripcion: "active"`, `puede_pagar: false`, `tiene_portal: true`
 *    Y CON EL ACCESO CORTADO (`motivo_de_corte_de_persona` la llama
 *    `plan_ajeno`). Los dos casos se separan con los booleanos del backend
 *    —`membresia_viva` y `plan_ajeno`— y NO con `plan_code` ni con la lista de
 *    estados de Stripe, que es del backend y copiada aquí se desincroniza:
 *      `membresia_viva` → está activa y se le dice así, con el portal.
 *      `plan_ajeno`     → se le nombra la otra suscripción, se le pide que
 *                         escriba y se le ofrece el portal, que es por donde lo
 *                         corrige. Ni "ya estás suscrito" (mentira) ni "paga"
 *                         (sería el segundo cobro).
 *    `plan_ajeno` no se deduce de `puede_pagar: false`, que también es falso con
 *    Stripe caído, el catálogo vacío o el interruptor de la venta apagado.
 *
 * 3. **Una membresía vacía.** Con `cursos_en_el_catalogo` en 0 no hay nada que
 *    entregar (el catálogo lo siembra la consola, y vacío es su valor por
 *    omisión), así que se avisa en vez de ofrecer la compra.
 *
 * Los errores se traducen por ESTADO y, en el 409, por el campo `motivo`;
 * NUNCA por el texto del backend, que es prosa en español y ya cambió una vez.
 * Los dos 409 del checkout significan cosas distintas y no se pueden mezclar.
 *
 * Contra el doble cobro: el botón se desactiva mientras la petición está en
 * curso y un ref descarta un segundo envío del mismo tick. El 409 del backend y
 * su candado de 60 s son la red de seguridad, no la primera línea.
 */

import { useRef, useState } from "react";

import { abrirPortal, iniciarCheckout } from "../lib/api";
import { useT } from "../i18n/client";
import ContactOwnersButton from "./ContactOwnersButton";
import styles from "./MembershipCard.module.css";

// Los dueños de la plataforma operan en inglés (mismo criterio que PlanCard).
const ASUNTO_MEMBRESIA = "Individual membership inquiry";

/**
 * Clave i18n del error de una acción. Por ESTADO, y dentro del 409 por el campo
 * `motivo`: son tres respuestas con el mismo código y tres mensajes distintos.
 *   membresia_viva → ya compró ESTO.
 *   plan_ajeno     → tiene otra suscripción cobrándose; decirle "ya estás
 *                    suscrito" sería mentira y decirle "paga" le cobraría dos
 *                    veces, así que se le pide que escriba.
 *   sin motivo     → el candado de 60 s: un pago ya en curso.
 */
function claveDeError(err) {
  const status = err && err.status;
  if (status === 409) {
    if (err.motivo === "membresia_viva") return "membership.errMembershipLive";
    if (err.motivo === "plan_ajeno") return "membership.errOtherPlan";
    return "membership.errInProgress";
  }
  if (status === 401) return "errSession";
  if (status === 403) return "errForbidden";
  if (status === 404) return "membership.errNotSellable";
  if (status === 503) return "membership.errPaymentsDown";
  return "errGeneric";
}

/** El texto de una clave de un grupo i18n (statuses) o, si no hay traducción, el
 *  valor tal cual lo mandó el backend. Misma función que en PlanCard: se repite
 *  (son cuatro líneas de i18n, no una regla de negocio) para no acoplar las dos
 *  tarjetas, que no comparten ningún campo. */
function traducido(t, grupo, valor) {
  const clave = `${grupo}.${valor}`;
  const texto = t(clave);
  return texto === `pay.${clave}` ? valor : texto;
}

export default function MembershipCard({ estado, pagoRecibido = false, onRefresh }) {
  const t = useT("pay");

  const ocupadoRef = useRef(false);
  const [enCurso, setEnCurso] = useState(null);   // null | "pay" | "portal" | "refresh"
  const [fallo, setFallo] = useState(null);       // {accion, err}

  /**
   * Corre una acción de una en una. `fn` devuelve true si navega fuera de la
   * página: ahí el botón se queda desactivado hasta que el navegador se vaya,
   * para que nadie lo pulse otra vez en ese intervalo.
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
    // Sin url no hay a dónde ir: navegar a `undefined` dejaría a la persona en
    // una página rota con el botón desactivado para siempre.
    if (typeof url !== "string" || !url) throw new Error("La respuesta no trae url.");
    window.location.href = url;
    return true;
  }

  const pagar = () => ejecutar("pay", () => irA(iniciarCheckout));
  const portal = () => ejecutar("portal", () => irA(abrirPortal));
  const revisar = () => ejecutar("refresh", async () => { await onRefresh(); });

  if (!estado.facturacion_activa) {
    return (
      <section className={styles.card}>
        <p className={styles.muted}>{t("billingOff")}</p>
      </section>
    );
  }

  // Nada de esto interpreta estados de Stripe: lo que se ofrece y lo que se
  // afirma lo dicen los booleanos del backend (`membresia_viva`, `plan_ajeno`,
  // `puede_pagar`, `tiene_portal`).
  const viva = Boolean(estado.membresia_viva);
  const ajeno = Boolean(estado.plan_ajeno);
  const haySuscripcion = Boolean(estado.estado_suscripcion);
  // `null` = el backend no mandó el número. No se dice ni que esté vacío ni
  // cuántos cursos tiene: las dos cosas serían inventadas.
  const cursos = typeof estado.cursos_en_el_catalogo === "number"
    ? estado.cursos_en_el_catalogo : null;
  const sinCatalogo = cursos === 0;
  const hayPrecio = typeof estado.precio_mensual_usd === "number";
  /**
   * Los dos bloques son INDEPENDIENTES, y no uno o el otro: una membresía
   * cancelada llega con `estado_suscripcion: "canceled"` Y `puede_pagar: true`
   * —no cobra, así que se le puede vender de nuevo—, y con el estado tapando la
   * oferta, quien canceló se quedaba sin forma de volver.
   *
   * `!viva && !ajeno` es explícito aunque hoy los dos impliquen
   * `puede_pagar: false` (los dos son `suscripcion_cobrando`): si alguna vez
   * llegaran juntos, ofrecer el botón sería el segundo cobro. Falla cerrado.
   */
  const hayOferta = !viva && !ajeno && (!haySuscripcion || estado.puede_pagar);
  const esPlanAjeno = Boolean(fallo && fallo.err && fallo.err.motivo === "plan_ajeno");

  const etiquetaPagar = fallo && fallo.accion === "pay"
    ? t("retry")
    : enCurso === "pay" ? t("membership.redirecting") : t("membership.pay");

  const botonDelPortal = estado.tiene_portal ? (
    <button type="button" className="btn-ghost" onClick={portal} disabled={enCurso !== null}>
      {enCurso === "portal" ? t("openingPortal") : t("manageBilling")}
    </button>
  ) : null;

  return (
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>
        {viva ? t("membership.activeTitle")
          : haySuscripcion ? t("membership.subscriptionTitle") : t("membership.title")}
      </h2>

      {haySuscripcion && (
        <p className={styles.data}>
          {t("statusLabel", { status: traducido(t, "statuses", estado.estado_suscripcion) })}
        </p>
      )}

      {/* Los tres estados, cada uno con su frase. Ver el punto 2 de la cabecera.
          Una fila muerta (cancelada, impaga) no es ninguno de los dos: ahí el
          estado de arriba es todo lo que se puede afirmar, y debajo va la
          oferta de volver a contratar. */}
      {viva && (
        // Viva Y sin cursos: se cobra y no se entrega nada. El backend no corta
        // el acceso con el catálogo vacío a propósito, así que este estado
        // existe en producción y "tienes acceso a los cursos" sería falso. No se
        // dice que el cobro se detuvo, porque no se detuvo: se manda a escribir.
        sinCatalogo ? (
          <>
            <p className={styles.muted}>{t("membership.activeEmpty")}</p>
            <ContactOwnersButton
              subject={ASUNTO_MEMBRESIA}
              label={t("membership.contact")}
              className="btn-ghost"
            />
          </>
        ) : (
          <p className={styles.muted}>{t("membership.active")}</p>
        )
      )}
      {ajeno && (
        <>
          <p className={styles.muted}>{t("membership.otherPlanBody")}</p>
          {/* El plan REAL de la fila, que es lo que hay que arreglar en Stripe.
              Nulo cuando el precio no tiene un lookup key conocido: entonces no
              se nombra nada. */}
          {estado.plan_code && (
            <p className={styles.data}>
              {t("membership.otherPlanLabel", {
                plan: traducido(t, "plans", estado.plan_code),
              })}
            </p>
          )}
          <ContactOwnersButton
            subject={ASUNTO_MEMBRESIA}
            label={t("membership.contact")}
            className="btn-ghost"
          />
        </>
      )}

      {hayOferta && (
        <div className={haySuscripcion ? styles.block : undefined}>
          {sinCatalogo ? (
            // Falla cerrado: sin catálogo no se ofrece comprar nada.
            <p className={styles.muted}>{t("membership.emptyCatalog")}</p>
          ) : (
            <>
              {!haySuscripcion && <p className={styles.muted}>{t("membership.body")}</p>}
              {hayPrecio && (
                <p className={styles.data}>{t("pricePerMonth", { price: estado.precio_mensual_usd })}</p>
              )}
              {cursos !== null && (
                <p className={styles.data}>{t(cursos === 1 ? "membership.coursesIncludedOne" : "membership.coursesIncluded", { count: cursos })}</p>
              )}
              {!hayPrecio && (
                <>
                  <p className={styles.muted}>{t("membership.noPrice")}</p>
                  <button type="button" className="btn-ghost" onClick={revisar} disabled={enCurso !== null}>
                    {t("retry")}
                  </button>
                </>
              )}
              {estado.puede_pagar && (
                pagoRecibido ? (
                  // El pago ya se hizo y el webhook aún no lo reflejó: ofrecer
                  // "pagar" otra vez sería un segundo cobro.
                  <button type="button" className="btn-ghost" onClick={revisar} disabled={enCurso !== null}>
                    {t("checkAgain")}
                  </button>
                ) : (
                  <button type="button" className="btn-primary" onClick={pagar} disabled={enCurso !== null}>
                    {etiquetaPagar}
                  </button>
                )
              )}
              {/* Solo sin suscripción: con una, su estado ya explica por qué no
                  se vende, y repetirlo sonaría a que algo va mal. */}
              {!estado.puede_pagar && hayPrecio && !haySuscripcion && (
                <p className={styles.muted}>{t("membership.unavailable")}</p>
              )}
            </>
          )}
        </div>
      )}

      {botonDelPortal && <div className={styles.block}>{botonDelPortal}</div>}

      {fallo && (
        <>
          <p className={styles.error} role="alert">{t(claveDeError(fallo.err))}</p>
          {/* El plan ajeno se arregla hablando con nosotros: el precio está mal
              en Stripe y pagar otra vez sería el segundo cobro. `!ajeno` para no
              repetir el botón que ya pinta ese estado (hoy no pueden coincidir:
              con `plan_ajeno` no hay botón de pagar que pueda dar ese 409). */}
          {esPlanAjeno && !ajeno && (
            <ContactOwnersButton
              subject={ASUNTO_MEMBRESIA}
              label={t("membership.contact")}
              className="btn-ghost"
            />
          )}
        </>
      )}
    </section>
  );
}
