import ImportMembersClient from "./ImportMembersClient";
import { getT } from "../../../../i18n/server";
import styles from "./page.module.css";

export const metadata = {
  title: "Upload a file | Distinct Hospitality Solutions",
  description: "Add several people to your team at once with a .csv file.",
};

export default async function ImportMembersPage() {
  const t = await getT("companyAdmin");
  return (
    <div className={styles.page}>
      {/* No va un <main> aquí: el layout raíz ya envuelve cada página en uno
          (src/app/layout.js:65), y anidar dos es HTML inválido. */}
      <div className={`container ${styles.pageWrapper}`}>
        <h1 className={styles.h1}>{t("import.pageTitle")}</h1>
        <ImportMembersClient />
      </div>
    </div>
  );
}
