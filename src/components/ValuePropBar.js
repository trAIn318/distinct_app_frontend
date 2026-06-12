import { buildOwnersOutlookCompose } from "../lib/config";
import { getT } from "../i18n/server";
import Reveal from "./Reveal";
import styles from "./ValuePropBar.module.css";

// CTA unificado: igual que "I'm Interested" en cursos, contacta a los owners.
// El cuerpo del correo se mantiene en inglés (los owners operan en inglés).
const contactUrl = buildOwnersOutlookCompose(
  "General Inquiry — Distinct Hospitality Solutions",
  "Hi Veronica, Luznedy, and Hugo,\n\nI'd like to learn more about Distinct and how it can help my property.\n\nThank you,\n"
);

export default async function ValuePropBar() {
  const t = await getT("valueProp");

  return (
    <section className={styles.bar} aria-labelledby="value-prop-heading">
      <Reveal className={`container ${styles.container}`}>
        <h2 id="value-prop-heading" className={styles.headline}>
          {t("titlePre")}{" "}
          <span className="emphasized gold">{t("titleEmphasis")}</span>{" "}
          {t("titlePost")}
        </h2>
        <a
          href={contactUrl}
          className="btn-ghost"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("getInTouch")}
        </a>
      </Reveal>
    </section>
  );
}
