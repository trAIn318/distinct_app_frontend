import TrainWord from "./TrainWord";
import Reveal from "./Reveal";
import { getT } from "../i18n/server";
import styles from "./PlatformOverview.module.css";

export default async function PlatformOverview() {
  const t = await getT("platform");

  return (
    <section className={styles.section} aria-labelledby="platform-overview-heading">
      <Reveal group className={`container ${styles.contentWrapper}`}>
        <div className={styles.textContent}>
          <span className={styles.eyebrow}>{t("eyebrow")}</span>
          <h2 id="platform-overview-heading" className={styles.headline}>
            <TrainWord />{" "}{t("titleRest")}
          </h2>
          <p className={styles.bodyCopy}>
            {t("bodyPre")} <TrainWord />{" "}{t("bodyPost")}
          </p>
        </div>

        <div className={styles.imageWrapper}>
          <img
            src="/img/platform_overview.webp"
            alt="High-end luxury hotel front desk with professional staff"
            className={styles.image}
            loading="lazy"
          />
        </div>
      </Reveal>
    </section>
  );
}
