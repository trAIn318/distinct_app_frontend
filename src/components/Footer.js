import Link from "next/link";
import { getT } from "../i18n/server";
import styles from "./Footer.module.css";

/**
 * Footer global.
 * Nota: el bloque "Subscribe" (newsletter) se eliminó jun-2026 — era un
 * formulario simulado (nunca guardaba el email) y resultaba redundante
 * con el Sign Up de cuentas. Si en el futuro hay un servicio real de
 * newsletter, recuperar el bloque del historial de git y conectarlo.
 */
export default async function Footer() {
  const t = await getT("footer");

  return (
    <footer className={styles.footer} aria-label="Global Footer">
      <div className="container">
        <div className={styles.grid}>
          <div className={styles.brandColumn}>
            <Link href="/">
              <img
                src="/img/logo_cropped.png"
                alt="Distinct Hospitality Solutions"
                className={styles.footerLogoImage}
              />
            </Link>
            <p className={styles.tagline}>{t("tagline")}</p>
          </div>

          <div className={styles.infoColumn}>
            <p className={styles.infoText}>
              <Link href="/privacy-policy" className={`${styles.privacyLink} link-underline`}>
                {t("privacy")}
              </Link>
            </p>
            <p className={styles.infoText}>{t("location")}</p>
            <p className={styles.infoText}>{t("response")}</p>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className={styles.bottomBar}>
          <span className={styles.copyright}>{t("copyright")}</span>
        </div>
      </div>
    </footer>
  );
}
