import TrainWord from "./TrainWord";
import styles from "./HowItWorks.module.css";

export default function HowItWorks() {
  return (
    <section className={styles.section} aria-labelledby="how-it-works-heading">
      <div className="container">
        <header className={styles.header}>
          <span className={styles.eyebrow}>HOW IT WORKS</span>
          <h2 id="how-it-works-heading" className={styles.headline}>
            <TrainWord />{" "}→ Track → Analyze → Grow
          </h2>
        </header>

        <div className={styles.grid}>
          {/* Step 1 */}
          <article className={styles.stepCard}>
            <div className={styles.imageWrapper}>
              <img src="/img/step_train.png" alt="Bartender training on a tablet" className={styles.image} loading="lazy" />
            </div>
            <span className={styles.stepNumber}>Step 1</span>
            <h3 className={styles.stepTitle}><TrainWord /></h3>
            <p className={styles.stepBody}>
              Your standards. Every employee. Every shift. AI-powered, role-specific microlearning your team completes on any device, in any language. ARIA — our intelligent coaching agent — guides every session.
            </p>
          </article>

          {/* Step 2 */}
          <article className={styles.stepCard}>
            <div className={styles.imageWrapper}>
              <img src="/img/step_track.png" alt="Sleek modern POS system showing analytics" className={styles.image} loading="lazy" />
            </div>
            <span className={styles.stepNumber}>Step 2</span>
            <h3 className={styles.stepTitle}>Track</h3>
            <p className={styles.stepBody}>
              Behavior connects to results. Capture what actually happens on the floor: upsell conversions, greeting standards, service recovery actions, guest interaction quality. Real data from real shifts.
            </p>
          </article>

          {/* Step 3 */}
          <article className={styles.stepCard}>
            <div className={styles.imageWrapper}>
              <img src="/img/step_analyze.png" alt="Luxury hotel guest smiling warmly" className={styles.image} loading="lazy" />
            </div>
            <span className={styles.stepNumber}>Step 3</span>
            <h3 className={styles.stepTitle}>Analyze</h3>
            <p className={styles.stepBody}>
              Know what your guests feel before they post it. GuestSight surfaces sentiment in real time — by shift, by department, by employee. Act while the guest is still in the building. Turn a complaint into a loyal return.
            </p>
          </article>

          {/* Step 4 */}
          <article className={styles.stepCard}>
            <div className={styles.imageWrapper}>
              <img src="/img/step_optimize.png" alt="Restaurant manager coaching staff" className={styles.image} loading="lazy" />
            </div>
            <span className={styles.stepNumber}>Step 4</span>
            <h3 className={styles.stepTitle}>Grow</h3>
            <p className={styles.stepBody}>
              Performance becomes revenue. Connect training completion to sales per cover, average check, upsell rate, and tip percentage. See exactly where your investment went and who it moved.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
