import TrainWord from "./TrainWord";
import Reveal from "./Reveal";
import { getT } from "../i18n/server";
import styles from "./HowItWorks.module.css";

const STEP_IMAGES = [
  { src: "/img/step_train.webp", alt: "Bartender training on a tablet" },
  { src: "/img/step_track.webp", alt: "Sleek modern POS system showing analytics" },
  { src: "/img/step_analyze.webp", alt: "Luxury hotel guest smiling warmly" },
  { src: "/img/step_optimize.webp", alt: "Restaurant manager coaching staff" },
];

export default async function HowItWorks() {
  const t = await getT("howItWorks");

  const steps = [1, 2, 3, 4].map((n) => ({
    n,
    title: t(`step${n}Title`),
    body: t(`step${n}Body`),
    image: STEP_IMAGES[n - 1],
  }));

  return (
    <section className={styles.section} aria-labelledby="how-it-works-heading">
      <div className="container">
        <Reveal as="header" className={styles.header}>
          <span className={styles.eyebrow}>{t("eyebrow")}</span>
          <h2 id="how-it-works-heading" className={styles.headline}>
            <TrainWord />{" "}{t("titleRest")}
          </h2>
        </Reveal>

        <Reveal group className={styles.grid}>
          {steps.map((step) => (
            <article key={step.n} className={styles.stepCard}>
              <div className={styles.imageWrapper}>
                <img
                  src={step.image.src}
                  alt={step.image.alt}
                  className={styles.image}
                  loading="lazy"
                />
              </div>
              <span className={styles.stepNumber}>
                {t("stepLabel", { n: step.n })}
              </span>
              <h3 className={styles.stepTitle}>
                {step.n === 1 ? <TrainWord /> : step.title}
              </h3>
              <p className={styles.stepBody}>{step.body}</p>
            </article>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
