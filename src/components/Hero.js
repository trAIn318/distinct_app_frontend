import Link from "next/link";
import { MOODLE_URL } from "../lib/config";
import { getT } from "../i18n/server";
import styles from "./Hero.module.css";

export default async function Hero() {
  const t = await getT("hero");

  return (
    <section className={styles.hero} aria-labelledby="hero-heading">
      <div className={`container ${styles.heroInner}`}>
        <div className={styles.heroContent}>
          <span className={styles.eyebrow}>{t("eyebrow")}</span>

          <h1 id="hero-heading" className={styles.subHeadline}>
            {t("titlePre")}{" "}
            <span className="emphasized gold">{t("titleEmphasis")}</span>
            {t("titlePost")}
          </h1>

          <p className={styles.bodyCopy}>{t("body")}</p>

          <div className={styles.ctaGroup}>
            <Link href="/register" className="btn-primary">
              {t("getStarted")}
            </Link>
            <a
              href="https://aria-distinct.onrender.com"
              className="btn-white"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("meetAria")}
            </a>
            <a
              href={MOODLE_URL}
              className="btn-ghost"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("accessMoodle")}
            </a>
          </div>
        </div>
      </div>

      <div className={styles.scrollCue} aria-hidden="true">
        <span className={styles.scrollCueLine}></span>
      </div>
    </section>
  );
}
