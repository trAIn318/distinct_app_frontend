import PanelClient from "./PanelClient";
import { getT } from "../../../i18n/server";
import styles from "./page.module.css";

export const metadata = {
  title: "Sales dashboard | Distinct Hospitality Solutions",
  description: "Sales analytics dashboard.",
};

export default async function AnalyticsPanelPage() {
  const t = await getT("analytics");
  return (
    <div className={styles.page}>
      <div className={`container ${styles.wrapper}`}>
        <h1 className={styles.h1}>{t("panelTitle")}</h1>
        <PanelClient />
      </div>
    </div>
  );
}
