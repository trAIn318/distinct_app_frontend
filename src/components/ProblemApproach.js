import styles from "./ProblemApproach.module.css";

export default function ProblemApproach() {
  return (
    <section className={styles.section} aria-labelledby="problem-approach-heading">
      <div className="container">
        <span className={styles.sectionLabel}>The Real Cost of Inconsistency</span>
        <h2 id="problem-approach-heading" className={styles.sectionHeadline}>
          Training Doesn&apos;t Fail. Measurement Does.
        </h2>
        
        <div className={styles.grid}>
          {/* Problem Block (~61.8%) */}
          <div className={styles.problemColumn}>
            <h3 className={styles.blockHeadline}>
              Every hotel, restaurant, and private club invests in training. Most can&apos;t answer three questions:
            </h3>
            <ul className={styles.problemList}>
              <li className={styles.problemItem}>
                Did training increase revenue?
              </li>
              <li className={styles.problemItem}>
                Which behaviors drive guest satisfaction?
              </li>
              <li className={styles.problemItem}>
                Who are your top performers and what makes them different?
              </li>
              <li className={styles.problemItem}>
                Without data, you&apos;re investing in hope.
              </li>
            </ul>
          </div>

          {/* Approach Block (~38.2%) */}
          <div className={styles.approachColumn}>
            <h3 className={styles.blockHeadline}>
              Our Approach — A Performance System. Not Just Training
            </h3>
            <p className={styles.approachBody}>
              Without that intelligence, training is a cost center. With Distinct, it becomes a competitive advantage.
            </p>
            <div>
              <a
                href="mailto:info@distincthospitalitysolutions.com"
                className="btn-primary"
              >
                Get Started
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
