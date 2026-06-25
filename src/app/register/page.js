import RegisterForm from "./RegisterForm";
import { getActivePolicy } from "../../lib/api";
import { getT } from "../../i18n/server";
import styles from "../login/page.module.css";

export const metadata = {
  title: "Sign Up | Distinct Hospitality Solutions",
  description: "Create your Distinct account.",
};

export default async function RegisterPage() {
  const t = await getT("register");

  // Trae la política vigente para mostrarla en el modal/consent.
  // Si el backend no responde, la página igual funciona — el RegisterForm
  // lo maneja con un fallback informativo.
  const policy = await getActivePolicy().catch(() => null);

  return (
    <div className={styles.page}>
      <div className={`container ${styles.wrapper}`}>
        <span className={styles.eyebrow}>{t("eyebrow")}</span>
        <h1 className={styles.h1}>{t("title")}</h1>
        <p className={styles.copy}>{t("copy")}</p>
        <RegisterForm policy={policy} />
      </div>
    </div>
  );
}
