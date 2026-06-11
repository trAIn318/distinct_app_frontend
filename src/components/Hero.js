import Link from "next/link";
import { MOODLE_URL } from "../lib/config";
import styles from "./Hero.module.css";

export default function Hero() {
  return (
    <section className={styles.hero} aria-labelledby="hero-heading">
      <div className={`container ${styles.heroInner}`}>
        <div className={styles.heroContent}>
          <span className={styles.eyebrow}>Distinct Hospitality Solutions</span>

          <h1 id="hero-heading" className={styles.subHeadline}>
            The AI Platform Built for the People Who Run{" "}
            <span className="emphasized gold">Hospitality</span>.
          </h1>

          <p className={styles.bodyCopy}>
            Distinct trains your team, tracks what matters, and turns staff
            performance into measurable revenue — across every shift, every
            property, every market.
          </p>

          <div className={styles.ctaGroup}>
            <Link href="/register" className="btn-primary">
              Get Started
            </Link>
            <a
              href="https://aria-distinct.onrender.com"
              className="btn-white"
              target="_blank"
              rel="noopener noreferrer"
            >
              Meet ARIA
            </a>
            <a
              href={MOODLE_URL}
              className="btn-ghost"
              target="_blank"
              rel="noopener noreferrer"
            >
              Access Moodle
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
