import TrainWord from "./TrainWord";
import ReactiveImage from "./ReactiveImage";
import styles from "./Solutions.module.css";

export default function Solutions() {
  return (
    <section className={styles.section} aria-labelledby="solutions-heading">
      <div className="container">
        <span className={styles.sectionLabel}>From Miami to the World</span>
        <h2 id="solutions-heading" className={styles.sectionHeadline}>
          Built for Every Corner of Hospitality.
        </h2>

        <div className={styles.grid}>
          {/* Card 1 */}
          <article className={styles.card}>
            <div className={styles.cardImageWrapper}>
              <ReactiveImage src="/img/card_culinary.webp" alt="Lively upscale high-end restaurant scene" ratio="16:9" className={styles.cardImage} />
            </div>
            <div className={styles.cardContent}>
              <div className={styles.eyebrow}><TrainWord /> + GUESTSIGHT</div>
              <h3 className={styles.cardTitle}>Hotels, Bars &amp; Restaurants</h3>
              <p className={styles.tagline}>Measurable performance. Real revenue results.</p>
              <div className={styles.ctaWrapper}>
                <a href="mailto:info@distincthospitalitysolutions.com" className="btn-ghost">
                  Book a discovery call
                </a>
              </div>
            </div>
          </article>

          {/* Card 2 */}
          <article className={styles.card}>
            <div className={styles.cardImageWrapper}>
              <ReactiveImage src="/img/card_estate.webp" alt="Luxury concierge or bespoke private event setting" ratio="16:9" className={styles.cardImage} />
            </div>
            <div className={styles.cardContent}>
              <div className={styles.eyebrow}>BESPOKE / CONCIERGE</div>
              <h3 className={styles.cardTitle}>Private Clients</h3>
              <p className={styles.tagline}>Workforce intelligence for discerning operations. Designed around your standards, your people, your brand.</p>
              <div className={styles.ctaWrapper}>
                <a href="mailto:info@distincthospitalitysolutions.com" className="btn-ghost">
                  Submit an inquiry
                </a>
              </div>
            </div>
          </article>

          {/* Card 3 */}
          <article className={styles.card}>
            <div className={styles.cardImageWrapper}>
              <ReactiveImage src="/img/card_resident.webp" alt="Luxury high-rise condominium lobby" ratio="16:9" className={styles.cardImage} />
            </div>
            <div className={styles.cardContent}>
              <div className={styles.eyebrow} aria-hidden="true"></div>
              <h3 className={styles.cardTitle}>Residential</h3>
              <p className={styles.tagline}>Compliance, culture, and consistent excellence across every floor.</p>
              <div className={styles.ctaWrapper}>
                <a href="mailto:info@distincthospitalitysolutions.com" className="btn-ghost">
                  Join the waitlist
                </a>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
