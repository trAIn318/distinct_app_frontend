import Link from "next/link";
import styles from "./Footer.module.css";

/**
 * Footer global.
 * Nota: el bloque "Subscribe" (newsletter) se eliminó jun-2026 — era un
 * formulario simulado (nunca guardaba el email) y resultaba redundante
 * con el Sign Up de cuentas. Si en el futuro hay un servicio real de
 * newsletter, recuperar el bloque del historial de git y conectarlo.
 */
export default function Footer() {
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
            <p className={styles.tagline}>
              The AI platform built for the people who run hospitality.
            </p>
          </div>

          <div className={styles.infoColumn}>
            <p className={styles.infoText}>
              <Link href="/privacy-policy" className={styles.privacyLink}>
                Privacy Policy
              </Link>
            </p>
            <p className={styles.infoText}>
              Location: Based in Miami, FL. Operating across the USA, Latin America, and Southeast Asia.
            </p>
            <p className={styles.infoText}>
              Response time: We respond to all inquiries within 24 hours.
            </p>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className={styles.bottomBar}>
          <span className={styles.copyright}>
            © 2026 Distinct Hospitality Solutions LLC — All Rights Reserved.
          </span>
        </div>
      </div>
    </footer>
  );
}
