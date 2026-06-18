import AccountClient from "./AccountClient";
import { getT } from "../../i18n/server";
import styles from "./account.module.css";

export const metadata = {
  title: "My Account | Distinct Hospitality Solutions",
  description: "Manage your Distinct account and personal data.",
};

export default async function AccountPage() {
  const t = await getT("account");

  return (
    <div className={styles.page}>
      <div className={`container ${styles.wrapper}`}>
        <span className={styles.eyebrow}>{t("eyebrow")}</span>
        <h1 className={styles.h1}>{t("title")}</h1>
        <p className={styles.copy}>{t("copy")}</p>
        <AccountClient />
      </div>
    </div>
  );
}
