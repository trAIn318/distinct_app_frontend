import AdminCompanyClient from "./AdminCompanyClient";
import { getT } from "../../../i18n/server";
import styles from "./page.module.css";

export const metadata = {
  title: "Your team | Distinct Hospitality Solutions",
  description: "Add and manage the people on your team.",
};

export default async function AdminCompanyPage() {
  const t = await getT("companyAdmin");
  return (
    <div className={styles.page}>
      {/* No va un <main> aquí: el layout raíz ya envuelve cada página en uno
          (src/app/layout.js:65), y anidar dos es HTML inválido. */}
      <div className={`container ${styles.wrapper}`}>
        <h1 className={styles.h1}>{t("panel.pageTitle")}</h1>
        <AdminCompanyClient />
      </div>
    </div>
  );
}
