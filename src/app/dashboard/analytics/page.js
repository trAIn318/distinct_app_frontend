import AnalyticsUploadClient from "./AnalyticsUploadClient";
import { getT } from "../../../i18n/server";
import styles from "./page.module.css";

export const metadata = {
  title: "Sales upload | Distinct Hospitality Solutions",
  description: "Upload your Toast sales export and manage your properties.",
};

export default async function AnalyticsUploadPage() {
  const t = await getT("analytics");
  return (
    <div className={styles.page}>
      <div className={`container ${styles.wrapper}`}>
        <h1 className={styles.h1}>{t("uploadTitle")}</h1>
        <AnalyticsUploadClient />
      </div>
    </div>
  );
}
