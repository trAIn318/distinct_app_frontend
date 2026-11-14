"use client";

/**
 * MembershipCutoff — el aviso del 402 por membresía y su acción.
 *
 * Lo comparten las DOS puertas de ese 402: la lista de cursos del Tablero
 * (`DashboardMenu`) y el salto a Moodle (`/moodle-launch`). Es copy que toca
 * dinero ("paga" frente a "revisa lo que ya te cobran"), así que vive en un solo
 * sitio: dos copias se desincronizan y una de ellas acaba diciéndole "paga" a
 * quien ya tiene una suscripción cobrándose.
 *
 * Solo pinta el texto y el enlace a la pantalla de pagos. Lo que rodea al aviso
 * (el contenedor, y si se ofrece o no "abrir el curso") lo decide cada sitio: en
 * `/moodle-launch` ese enlace NO se pinta, porque sin matrícula lleva a una
 * página de Moodle que no entrega nada.
 */

import { useT } from "../i18n/client";

/** La ruta de la pantalla de pagos, la misma para las tres audiencias. */
export const RUTA_PAGOS = "/dashboard/pay";

/** El motivo de corte en el que NO se puede decir "paga": ya hay una
 *  suscripción cobrándose a su nombre que no es esta membresía, así que pagar
 *  sería el segundo cobro. Llega en `estado_suscripcion` del cuerpo del 402. */
export const PLAN_AJENO = "plan_ajeno";

export default function MembershipCutoff({ estado, textClassName, ctaClassName }) {
  const t = useT("pay");
  const ajeno = estado === PLAN_AJENO;
  return (
    <>
      <p className={textClassName}>
        {ajeno ? t("membership.cutoff.otherPlan") : t("membership.cutoff.needed")}
      </p>
      <a className={ctaClassName ? `btn-primary ${ctaClassName}` : "btn-primary"} href={RUTA_PAGOS}>
        {ajeno ? t("membership.cutoff.ctaManage") : t("membership.cutoff.cta")}
      </a>
    </>
  );
}
