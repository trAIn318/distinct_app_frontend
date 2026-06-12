import { Suspense } from "react";
import LoginForm from "./LoginForm";
import { getT } from "../../i18n/server";
import styles from "./page.module.css";

export const metadata = {
  title: "Sign In | Distinct Hospitality Solutions",
  description: "Sign in to your Distinct account.",
};

export default async function LoginPage() {
  const t = await getT("login");

  return (
    <div className={styles.page}>
      <div className={`container ${styles.wrapper}`}>
        <span className={styles.eyebrow}>{t("eyebrow")}</span>
        <h1 className={styles.h1}>{t("title")}</h1>
        <p className={styles.copy}>{t("copy")}</p>
        {/* LoginForm usa useSearchParams() (lee ?next= tras el login).
            Next exige envolverlo en Suspense para poder prerenderizar
            la página — sin esto, `next build` falla. */}
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
