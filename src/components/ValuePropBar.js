import { buildOwnersOutlookCompose } from "../lib/config";
import Reveal from "./Reveal";
import styles from "./ValuePropBar.module.css";

// CTA unificado: igual que "I'm Interested" en cursos, contacta a los owners
const contactUrl = buildOwnersOutlookCompose(
  "General Inquiry — Distinct Hospitality Solutions",
  "Hi Veronica, Luznedy, and Hugo,\n\nI'd like to learn more about Distinct and how it can help my property.\n\nThank you,\n"
);

export default function ValuePropBar() {
  return (
    <section className={styles.bar} aria-labelledby="value-prop-heading">
      <Reveal className={`container ${styles.container}`}>
        <h2 id="value-prop-heading" className={styles.headline}>
          Turn Staff Training Into{" "}
          <span className="emphasized gold">Measurable</span> Revenue Growth
        </h2>
        <a
          href={contactUrl}
          className="btn-ghost"
          target="_blank"
          rel="noopener noreferrer"
        >
          Get in Touch
        </a>
      </Reveal>
    </section>
  );
}
