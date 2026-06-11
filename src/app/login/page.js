import { Suspense } from "react";
import LoginForm from "./LoginForm";
import styles from "./page.module.css";

export const metadata = {
  title: "Sign In | Distinct Hospitality Solutions",
  description: "Sign in to your Distinct account.",
};

export default function LoginPage() {
  return (
    <div className={styles.page}>
      <div className={`container ${styles.wrapper}`}>
        <span className={styles.eyebrow}>Account</span>
        <h1 className={styles.h1}>Sign In</h1>
        <p className={styles.copy}>
          Welcome back. Sign in with your email or username.
        </p>
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
