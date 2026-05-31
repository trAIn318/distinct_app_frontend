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
        <LoginForm />
      </div>
    </div>
  );
}
