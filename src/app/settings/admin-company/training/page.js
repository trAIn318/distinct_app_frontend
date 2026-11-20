import TrainingClient from "./TrainingClient";
import { getT } from "../../../../i18n/server";
import styles from "./page.module.css";

export const metadata = {
  title: "Courses for your team | Distinct Hospitality Solutions",
  description: "Choose a course and cover several people on your team at once.",
};

export default async function TrainingPage() {
  const t = await getT("training");
  return (
    <div className={styles.page}>
      {/* No va un <main> aquí: el layout raíz ya envuelve cada página en uno. */}
      <div className={`container ${styles.pageWrapper}`}>
        <h1 className={styles.h1}>{t("pageTitle")}</h1>
        <TrainingClient />
      </div>
    </div>
  );
}
