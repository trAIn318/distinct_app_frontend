import styles from "./ValuePropBar.module.css";

export default function ValuePropBar() {
  return (
    <section className={styles.bar} aria-labelledby="value-prop-heading">
      <div className={`container ${styles.container}`}>
        <h2 id="value-prop-heading" className={styles.headline}>
          Turn Staff Training Into Measurable Revenue Growth
        </h2>
        <a
          href="mailto:info@distincthospitalitysolutions.com"
          className="btn-ghost"
        >
          Get in Touch
        </a>
      </div>
    </section>
  );
}
