import PropertiesClient from "./PropertiesClient";
import { getT } from "../../../../i18n/server";
import styles from "./page.module.css";

export const metadata = {
  title: "My properties | Distinct Hospitality Solutions",
  description: "Manage your properties.",
};

export default async function PropertiesPage() {
  const t = await getT("analytics");
  return (
    <div className={styles.page}>
      <div className={`container ${styles.wrapper}`}>
        <h1 className={styles.h1}>{t("propertiesTitle")}</h1>
        <PropertiesClient />
      </div>
    </div>
  );
}
