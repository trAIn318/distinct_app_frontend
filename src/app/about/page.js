import styles from "./page.module.css";
import TeamCard from "../../components/TeamCard";

export const metadata = {
  title: "About | Distinct Hospitality Solutions",
  description: "We Built Distinct Because We Lived the Problem.",
};

export default function About() {
  return (
    <div className={styles.page}>
      {/* Hero */}
      <section className={styles.hero} aria-labelledby="about-hero">
        <div className="container">
          <span className={styles.heroTag}>Our Story</span>
          <h1 id="about-hero" className={styles.heroH1}>
            We Built Distinct Because We Lived the <span className="emphasized gold">Problem</span>.
          </h1>
          <p className={styles.heroSubLabel}>Two decades in hospitality. Every role. Every market. One problem that never went away.</p>
        </div>
      </section>

      {/* Team Section */}
      <section className={styles.teamSection} aria-labelledby="team-heading">
        <div className="container">
          <span className={styles.heroTag}>The Team</span>
          <h2 id="team-heading" className={styles.teamHeadline}>
            Built by Operators. Powered by Intelligence.
          </h2>

          <div className={styles.teamGrid}>
            <TeamCard 
              image="/img/Veronica.png"
              name="Veronica Straw"
              role="Founder & CEO"
              email="Veronica@distincthospitalitysolutions.com"
              bio="Nearly two decades building, turning around, and leading hospitality operations across the USA, Latin America, and Southeast Asia. Veronica founded Distinct because she spent twenty years watching great talent get wasted by bad systems."
            />
            <TeamCard 
              image="/img/Luznedy.png"
              name="Luznedy Gomez"
              role="CTO"
              email="Luznedy@traindistinct.com"
              bio="The technical architecture behind Distinct's platform. Building the infrastructure that makes real-time intelligence possible at scale."
            />
            <TeamCard 
              image="/img/Hugo.png"
              name="Hugo F."
              role="CDO & Chief Data Science Officer"
              email="Hugo@traindistinct.com"
              bio="The intelligence layer. Hugo owns the data models, KPI frameworks, and the system that turns every ARIA conversation into performance insight."
            />
          </div>
        </div>
      </section>

      {/* Founding Story — MOST IMPORTANT SECTION */}
      <section className={styles.contentSection}>
        <div className={`container ${styles.storyContainer}`}>
          <h2 className={styles.storyHeadline}>The New Hire Story.</h2>
          <div className={styles.storyBody}>
            <p>
              A new hire starts their first day. They&apos;re motivated, ready, and full of potential. Then reality hits: no one has time. The manager is managing a crisis. The trainer is double-booked. So the new hire gets handed off to whoever is available — and spends their first two weeks absorbing that person&apos;s habits, their shortcuts, their version of the standards.
            </p>
            <p>
              Not the company&apos;s standards. One employee&apos;s standards.
            </p>
            <p>
              By month three, the property has a new team member who thinks they were trained. The manager has no idea what they actually know. And the guest experience is as inconsistent as ever.
            </p>
            <p>
              We saw this in five-star resorts. In Michelin-starred restaurants. In private clubs and luxury residences. The most sophisticated properties in the world had the same gap: no intelligent layer for the humans doing the work.
            </p>
            <p className={styles.storyHighlight}>
              <strong>Distinct is that layer.</strong>
            </p>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className={styles.missionSection}>
        <div className={`container ${styles.missionContainer}`}>
          <span className={styles.heroTag}>Why We Exist</span>
          <div className={styles.missionBody}>
            <p>
              Distinct doesn&apos;t replace your team. It works on their behalf — constantly. We are the silent operator running on your behalf, around the clock, so your people can focus on what only humans can do: making guests feel something.
            </p>
            <p>
              Our founding mission is to grow the hospitality workforce and make careers more purposeful. Not to replace workers with AI. To make every worker better at what they do — and visible for the value they create.
            </p>
          </div>
        </div>
      </section>

      {/* Markets Section */}
      <section className={styles.marketsSection} aria-labelledby="markets-heading">
        <div className={`container ${styles.marketsContainer}`}>
          <h2 id="markets-heading" className={styles.marketsHeadline}>Where We Operate.</h2>
          <p className={styles.marketsBody}>
            Based in Miami. Operating across the USA, Latin America, and Southeast Asia. Built for luxury and boutique hotels, restaurants, private clubs, residential properties, and HNW private clients. Expanding into corporate dining, transportation hospitality, J1 academies, and seasonal markets.
          </p>
        </div>
      </section>
    </div>
  );
}
