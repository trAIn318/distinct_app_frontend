import RegisterForm from "./RegisterForm";
import { getActivePolicy } from "../../lib/api";
import styles from "../login/page.module.css";

export const metadata = {
  title: "Sign Up | Distinct Hospitality Solutions",
  description: "Create your Distinct account.",
};

export default async function RegisterPage() {
  // Trae la política vigente para mostrarla en el modal/consent.
  // Si el backend no responde, la página igual funciona — el RegisterForm
  // lo maneja con un fallback informativo.
  const policy = await getActivePolicy().catch(() => null);

  return (
    <div className={styles.page}>
      <div className={`container ${styles.wrapper}`}>
        <span className={styles.eyebrow}>Account</span>
        <h1 className={styles.h1}>Create your account</h1>
        <p className={styles.copy}>
          A single account for our website and Moodle — same credentials
          everywhere.
        </p>
        <RegisterForm policy={policy} />
      </div>
    </div>
  );
}
