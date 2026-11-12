import PayClient from "./PayClient";
import { getT } from "../../../i18n/server";
import styles from "./PayClient.module.css";

export const metadata = {
  title: "Billing | Distinct Hospitality Solutions",
  description: "Your plan, your payments and your seats.",
};

export default async function PayPage({ searchParams }) {
  const t = await getT("pay");
  // Stripe devuelve aquí con ?pago=ok o ?pago=cancelado (billing_views.py).
  const { pago } = (await searchParams) ?? {};
  return (
    <div className={styles.page}>
      {/* Sin <main>: el layout raíz ya envuelve cada página en uno. */}
      <div className={`container ${styles.wrapper}`}>
        <h1 className={styles.h1}>{t("pageTitle")}</h1>
        <PayClient pago={typeof pago === "string" ? pago : undefined} />
      </div>
    </div>
  );
}
