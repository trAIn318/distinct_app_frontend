"use client";

/**
 * PayClient — la pantalla de pagos que tres audiencias comparten.
 *
 * Pide `GET /api/pay/mi-estado/` y despacha por el campo `soy`. NUNCA mira el
 * rol del usuario: la autorización es del servidor, y duplicarla aquí
 * serían dos sitios donde equivocarse.
 *   - admin_distinct → la consola de empresas (AdminBillingTable).
 *   - empresa        → el plan de su compañía y sus acciones (PlanCard).
 *   - individuo      → SIN IMPLEMENTAR: pertenece a otro plan (membresías). No
 *                      se pinta nada comprable hasta que exista.
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
import AdminBillingTable from "../../../components/AdminBillingTable";
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
        <button type="button" className="btn-ghost" onClick={() => cargar()}>
          {t("retry")}
        </button>
      </section>
    );
  }

  return (
    <>
      {estado.soy === "empresa" && <AvisoDePago pago={pago} t={t} />}
      <Panel estado={estado} pago={pago} onRefresh={() => cargar({ silencioso: true })} t={t} />
    </>
  );
}

/** `?pago=ok` NO significa que el plan ya esté activo: el webhook puede no
 *  haber llegado. Por eso el texto dice "recibido", nunca "activo". */
function AvisoDePago({ pago, t }) {
  if (pago === "ok") return <p className={styles.notice} role="status">{t("payOk")}</p>;
  if (pago === "cancelado") return <p className={styles.notice} role="status">{t("payCancelled")}</p>;
  return null;
}

function Panel({ estado, pago, onRefresh, t }) {
  switch (estado.soy) {
    case "admin_distinct":
      return <AdminBillingTable />;
    case "empresa":
      return <PlanCard estado={estado} pagoRecibido={pago === "ok"} onRefresh={onRefresh} />;
    case "individuo":
      // SIN IMPLEMENTAR a propósito: la membresía individual es de otro plan.
      // No se inventa una interfaz de compra aquí.
      return null;
    default:
      // "nada" y cualquier valor que esta versión no conozca: nada que comprar.
      return (
        <section className={styles.card}>
          <p className={styles.muted}>{t("nothingToBuy")}</p>
        </section>
      );
  }
}
