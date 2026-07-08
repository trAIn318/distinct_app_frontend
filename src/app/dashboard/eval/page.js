import EvalClient from "./EvalClient";
import { getT } from "../../../i18n/server";
import styles from "./page.module.css";

export const metadata = {
  title: "Evaluations | Distinct Hospitality Solutions",
  description: "Take and review your training evaluations.",
};

export default async function EvalPage() {
  const t = await getT("eval");

  return (
    <div className={styles.page}>
      <div className={`container ${styles.wrapper}`}>
        <h1 className={styles.h1}>{t("title")}</h1>
        <EvalClient />
      </div>
    </div>
  );
}
