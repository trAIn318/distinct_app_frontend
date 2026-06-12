import { buildOwnersOutlookCompose } from "../lib/config";
import { getT } from "../i18n/server";
import Reveal from "./Reveal";
import styles from "./ProblemApproach.module.css";

// CTA unificado: igual que "I'm Interested" en cursos, contacta a los owners
const contactUrl = buildOwnersOutlookCompose(
  "General Inquiry — Distinct Hospitality Solutions",
  "Hi Veronica, Luznedy, and Hugo,\n\nI'd like to learn more about Distinct and how it can help my property.\n\nThank you,\n"
);

export default async function ProblemApproach() {
  const t = await getT("problem");

  return (
    <section className={styles.section} aria-labelledby="problem-approach-heading">
      <div className="container">
        <Reveal>
          <span className={styles.sectionLabel}>{t("label")}</span>
          <h2 id="problem-approach-heading" className={styles.sectionHeadline}>
            {t("titlePre")}{" "}
            <span className="emphasized gold">{t("titleEmphasis")}</span>{" "}
            {t("titlePost")}
          </h2>
        </Reveal>

        <Reveal group className={styles.grid}>
          {/* Problem Block (~61.8%) */}
          <div className={styles.problemColumn}>
            <h3 className={styles.blockHeadline}>{t("blockHeadline")}</h3>
            <ul className={styles.problemList}>
              <li className={styles.problemItem}>{t("q1")}</li>
              <li className={styles.problemItem}>{t("q2")}</li>
              <li className={styles.problemItem}>{t("q3")}</li>
              <li className={styles.problemItem}>{t("q4")}</li>
            </ul>
          </div>

          {/* Approach Block (~38.2%) */}
          <div className={styles.approachColumn}>
            <h3 className={styles.blockHeadline}>{t("approachTitle")}</h3>
            <p className={styles.approachBody}>{t("approachBody")}</p>
            <div>
              <a
                href={contactUrl}
                className="btn-primary"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("cta")}
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
