import TrainWord from "./TrainWord";
import Reveal from "./Reveal";
import styles from "./PlatformOverview.module.css";

export default function PlatformOverview() {
  return (
    <section className={styles.section} aria-labelledby="platform-overview-heading">
      <Reveal group className={`container ${styles.contentWrapper}`}>
        <div className={styles.textContent}>
          <span className={styles.eyebrow}>
            FROM MIAMI TO THE WORLD
          </span>
          <h2 id="platform-overview-heading" className={styles.headline}>
            <TrainWord />{" "}smarter. Perform better. Earn more
          </h2>
          <p className={styles.bodyCopy}>
            Distinct is an AI-powered performance platform that tracks employee behavior, connects it to guest experience, and drives revenue across hospitality operations at scale. We <TrainWord />{" "}teams through our platform&apos;s immersive multilingual programs.
          </p>
        </div>

        <div className={styles.imageWrapper}>
          <img
            src="/img/platform_overview.png"
            alt="High-end luxury hotel front desk with professional staff"
            className={styles.image}
            loading="lazy"
          />
        </div>
      </Reveal>
    </section>
  );
}
