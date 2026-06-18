import { Suspense } from "react";
import ForgotPasswordForm from "./ForgotPasswordForm";
import { getT } from "../../i18n/server";
import styles from "./page.module.css";

export const metadata = {
  title: "Reset Password | Distinct Hospitality Solutions",
  description: "Reset the password for your Distinct account.",
};

export default async function ForgotPasswordPage() {
  const t = await getT("forgotPassword");

  return (
    <div className={styles.page}>
      <div className={`container ${styles.wrapper}`}>
        <span className={styles.eyebrow}>{t("eyebrow")}</span>
        <h1 className={styles.h1}>{t("title")}</h1>
        <p className={styles.copy}>{t("copy")}</p>
        {/* El formulario lee ?email= si viene del login, por eso va en Suspense
            (useSearchParams) — sin esto, `next build` falla al prerenderizar. */}
        <Suspense fallback={null}>
          <ForgotPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
