import Link from "next/link";
import { getT } from "../../i18n/server";
import styles from "./coming-soon.module.css";

export const metadata = {
  title: "Coming soon | Distinct Hospitality Solutions",
  description: "This section is under construction.",
};

export default async function ComingSoonPage() {
  const t = await getT("comingSoon");

  return (
    <div className={styles.page}>
      <div className={`container ${styles.wrapper}`}>
        <span className={styles.eyebrow}>{t("eyebrow")}</span>
        <h1 className={styles.h1}>{t("title")}</h1>
        <p className={styles.copy}>{t("copy")}</p>
        <Link href="/dashboard" className="btn-primary">
          {t("back")}
        </Link>
      </div>
    </div>
  );
}
