import styles from "./AriaFeature.module.css";

export default function AriaFeature() {
  return (
    <section className={styles.section} aria-labelledby="aria-feature-heading">
      <div className="container">
        <div className={styles.content}>
          <span className={styles.label}>Meet ARIA</span>
          <h2 id="aria-feature-heading" className={styles.headline}>
            The Mentor That Never Clocks Out.
          </h2>
          <div className={styles.body}>
            <p>
              ARIA is Distinct&apos;s AI coaching agent — built specifically for hospitality staff. She answers questions before a shift, guides decisions during one, and helps teams practice the moments that matter most.
            </p>
            <p>
              She speaks any language. She adapts to how each person thinks. She remembers every conversation and uses it to give better guidance over time. And she builds a performance profile of every employee — so managers see not just what their team knows, but who they&apos;re becoming.
            </p>
          </div>
          <div className={styles.ctaWrapper}>
            <a
              href="https://aria-distinct.onrender.com"
              className="btn-primary"
              target="_blank"
              rel="noopener noreferrer"
            >
              Talk to ARIA →
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
