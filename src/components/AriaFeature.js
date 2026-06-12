import Reveal from "./Reveal";
import { getT } from "../i18n/server";
import styles from "./AriaFeature.module.css";

export default async function AriaFeature() {
  const t = await getT("aria");

  return (
    <section className={styles.section} aria-labelledby="aria-feature-heading">
      <div className="container">
        <Reveal className={styles.content}>
          <span className={styles.label}>{t("label")}</span>
          <h2 id="aria-feature-heading" className={styles.headline}>
            {t("title")}
          </h2>
          <div className={styles.body}>
            <p>{t("p1")}</p>
            <p>{t("p2")}</p>
          </div>
          <div className={styles.ctaWrapper}>
            <a
              href="https://aria-distinct.onrender.com"
              className="btn-primary"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("cta")}
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
