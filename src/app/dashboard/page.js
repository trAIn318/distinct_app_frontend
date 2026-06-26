import DashboardClient from "./DashboardClient";
import { getT } from "../../i18n/server";
import styles from "./dashboard.module.css";

export const metadata = {
  title: "Dashboard | Distinct Hospitality Solutions",
  description: "Your enrolled courses and training progress.",
};

export default async function DashboardPage() {
  const t = await getT("dashboard");

  return (
    <div className={styles.page}>
      <div className={`container ${styles.wrapper}`}>
        <span className={styles.eyebrow}>{t("eyebrow")}</span>
        <h1 className={styles.h1}>{t("title")}</h1>
        <p className={styles.copy}>{t("copy")}</p>
        <DashboardClient />
      </div>
    </div>
  );
}
