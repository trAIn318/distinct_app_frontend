"use client";

/**
 * PayClient — la pantalla de pagos que tres audiencias comparten.
 *
 * Pide `GET /api/pay/mi-estado/` y despacha por el campo `soy`. NUNCA mira el
 * rol del usuario: la autorización es del servidor, y duplicarla aquí
 * serían dos sitios donde equivocarse.
 *   - admin_distinct → la consola de empresas (AdminBillingTable) y el catálogo
 *                      de la membresía (CatalogPicker). Son dos paneles
 *                      hermanos y NO uno dentro del otro: si la lista de
 *                      empresas falla, el catálogo —la única pantalla donde se
 *                      ve un curso muerto u oculto que ya se está cobrando—
 *                      tiene que seguir ahí.
 *   - empresa        → el plan de su compañía y sus acciones (PlanCard).
 *   - individuo      → su membresía (MembershipCard). No comparte ni un campo
 *                      con el panel de empresa: una membresía no tiene cupos.
 *   - nada           → el cuerpo viene mínimo a propósito (solo `soy` y si la
 *                      facturación está activa); no se asume ningún otro campo.
 *
 * Errores de carga, por ESTADO y no por texto (mismo criterio que
 * AdminCompanyClient): un 401 pide iniciar sesión —reintentar no puede
 * funcionar con un token vencido—; cualquier otro fallo es reintentable.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getMiEstadoDePago } from "../../../lib/api";
import { isAuthenticated } from "../../../lib/session";
import { useT } from "../../../i18n/client";
import PlanCard from "../../../components/PlanCard";
import MembershipCard from "../../../components/MembershipCard";
import AdminBillingTable from "../../../components/AdminBillingTable";
import CatalogPicker from "../../../components/CatalogPicker";
import styles from "./PayClient.module.css";

const RUTA = "/dashboard/pay";

/** A los 4 s se avisa que el servicio puede estar despertando (Render free). */
const AVISO_MS = 4000;

const FASE = {
  CARGANDO: "cargando",
  LISTO: "listo",
  SESION_VENCIDA: "sesionVencida",
  FALLO: "fallo",
};

export default function PayClient({ pago }) {
  const t = useT("pay");
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [fase, setFase] = useState(FASE.CARGANDO);
  const [estado, setEstado] = useState(null);
  const [despertando, setDespertando] = useState(false);

  // La sesión vive en una cookie que el servidor no lee: el `ready` pasa
  // después de montar para no provocar un error de hidratación.
  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace(`/login?next=${RUTA}`);
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ver arriba
    setReady(true);
  }, [router]);

  /** Carga el estado. Con `silencioso` no vuelve a la pantalla de carga (el
   *  panel sigue montado) y propaga el error a quien lo pidió. */
  const cargar = useCallback(async ({ silencioso = false } = {}) => {
    if (!silencioso) setFase(FASE.CARGANDO);
    try {
      const datos = await getMiEstadoDePago();
      setEstado(datos);
      setFase(FASE.LISTO);
    } catch (err) {
      if (silencioso) throw err;
      setFase(err && err.status === 401 ? FASE.SESION_VENCIDA : FASE.FALLO);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    const avisa = setTimeout(() => setDespertando(true), AVISO_MS);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial
    cargar().finally(() => clearTimeout(avisa));
    return () => clearTimeout(avisa);
  }, [ready, cargar]);

  const irALogin = () => router.replace(`/login?next=${RUTA}`);

  if (!ready || fase === FASE.CARGANDO) {
    return (
      <section className={styles.card} aria-busy="true">
        <p className={styles.muted}>{t("loading")}</p>
        {despertando && <p className={styles.muted}>{t("waking")}</p>}
      </section>
    );
  }

  if (fase === FASE.SESION_VENCIDA) {
    return (
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>{t("signedOutTitle")}</h2>
        <p className={styles.muted}>{t("signedOutBody")}</p>
        <button type="button" className="btn-primary" onClick={irALogin}>
          {t("signIn")}
        </button>
      </section>
    );
  }

  if (fase === FASE.FALLO) {
    return (
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>{t("loadFailedTitle")}</h2>
        <p className={styles.error} role="alert">{t("loadFailedBody")}</p>
        {/* Volver de Stripe con ?pago=ok significa que el cargo YA pudo ocurrir:
            un GET fallido no dice nada del cobro, así que aquí no se afirma ni
            se niega; se dice dónde está el pago. */}
        {pago === "ok" && <p className={styles.notice} role="status">{t("payOkLoadFailed")}</p>}
        <button type="button" className="btn-ghost" onClick={() => cargar()}>
          {t("retry")}
        </button>
      </section>
    );
  }

  // Los dos sujetos que pueden volver de Stripe son la empresa y el individuo;
  // cada uno con su texto, porque lo que aparecerá es un plan o una membresía.
  const compra = estado.soy === "empresa" || estado.soy === "individuo";

  return (
    <>
      {compra && (
        <AvisoDePago
          pago={pago}
          yaAparecio={!estado.puede_pagar}
          claveOk={estado.soy === "individuo" ? "membership.payOk" : "payOk"}
          t={t}
        />
      )}
      <Panel estado={estado} pago={pago} onRefresh={() => cargar({ silencioso: true })} t={t} />
    </>
  );
}

/** `?pago=ok` NO significa que el plan o la membresía ya estén activos: el
 *  webhook puede no haber llegado. Por eso el texto dice "recibido", nunca
 *  "activo". */
function AvisoDePago({ pago, yaAparecio, claveOk, t }) {
  // Cuando el backend ya no ofrece pagar, lo comprado apareció: "aparecerá en un
  // momento" sería falso sobre algo que ya está ahí.
  if (pago === "ok" && !yaAparecio) return <p className={styles.notice} role="status">{t(claveOk)}</p>;
  if (pago === "cancelado") return <p className={styles.notice} role="status">{t("payCancelled")}</p>;
  return null;
}

function Panel({ estado, pago, onRefresh, t }) {
  switch (estado.soy) {
    case "admin_distinct":
      // Hermanos, no anidados: ver la cabecera del archivo.
      return (
        <>
          <AdminBillingTable />
          <CatalogPicker />
        </>
      );
    case "empresa":
      return <PlanCard estado={estado} pagoRecibido={pago === "ok"} onRefresh={onRefresh} />;
    case "individuo":
      return <MembershipCard estado={estado} pagoRecibido={pago === "ok"} onRefresh={onRefresh} />;
    default:
      // "nada" y cualquier valor que esta versión no conozca: nada que comprar.
      return (
        <section className={styles.card}>
          <p className={styles.muted}>{t("nothingToBuy")}</p>
        </section>
      );
  }
}
