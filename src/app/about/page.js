import styles from "./page.module.css";
import TeamCard from "../../components/TeamCard";
import Reveal from "../../components/Reveal";
import { getT } from "../../i18n/server";

export const metadata = {
  title: "About | Distinct Hospitality Solutions",
  description: "We Built Distinct Because We Lived the Problem.",
};

export default async function About() {
  const t = await getT("aboutPage");

  const team = [
    {
      image: "/img/Veronica.png",
      name: "Veronica Straw",
      role: t("roleVeronica"),
      email: "Veronica@distincthospitalitysolutions.com",
      bio: t("bioVeronica"),
    },
    {
      image: "/img/Luznedy.png",
      name: "Luznedy Gomez",
      role: t("roleLuznedy"),
      email: "Luznedy@traindistinct.com",
      bio: t("bioLuznedy"),
    },
    {
      image: "/img/Hugo.png",
      name: "Hugo F.",
      role: t("roleHugo"),
      email: "Hugo@traindistinct.com",
      bio: t("bioHugo"),
    },
  ];

  return (
    <div className={styles.page}>
      {/* Hero */}
      <section className={styles.hero} aria-labelledby="about-hero">
        <Reveal className="container">
          <span className={styles.heroTag}>{t("heroTag")}</span>
          <h1 id="about-hero" className={styles.heroH1}>
            {t("heroTitlePre")}{" "}
            <span className="emphasized gold">{t("heroTitleEmphasis")}</span>
            {t("heroTitlePost")}
          </h1>
          <p className={styles.heroSubLabel}>{t("heroSub")}</p>
        </Reveal>
      </section>

      {/* Team Section */}
      <section className={styles.teamSection} aria-labelledby="team-heading">
        <div className="container">
          <Reveal>
            <span className={styles.heroTag}>{t("teamTag")}</span>
            <h2 id="team-heading" className={styles.teamHeadline}>
              {t("teamTitle")}
            </h2>
          </Reveal>

          <Reveal group className={styles.teamGrid}>
            {team.map((member) => (
              <TeamCard key={member.name} {...member} />
            ))}
          </Reveal>
        </div>
      </section>

      {/* Founding Story — MOST IMPORTANT SECTION */}
      <section className={styles.contentSection}>
        <Reveal className={`container ${styles.storyContainer}`}>
          <h2 className={styles.storyHeadline}>{t("storyTitle")}</h2>
          <div className={styles.storyBody}>
            <p>{t("storyP1")}</p>
            <p>{t("storyP2")}</p>
            <p>{t("storyP3")}</p>
            <p>{t("storyP4")}</p>
            <p className={styles.storyHighlight}>
              <strong>{t("storyHighlight")}</strong>
            </p>
          </div>
        </Reveal>
      </section>

      {/* Mission Section */}
      <section className={styles.missionSection}>
        <Reveal className={`container ${styles.missionContainer}`}>
          <span className={styles.heroTag}>{t("missionTag")}</span>
          <div className={styles.missionBody}>
            <p>{t("missionP1")}</p>
            <p>{t("missionP2")}</p>
          </div>
        </Reveal>
      </section>

      {/* Markets Section */}
      <section className={styles.marketsSection} aria-labelledby="markets-heading">
        <Reveal className={`container ${styles.marketsContainer}`}>
          <h2 id="markets-heading" className={styles.marketsHeadline}>
            {t("marketsTitle")}
          </h2>
          <p className={styles.marketsBody}>{t("marketsBody")}</p>
        </Reveal>
      </section>
    </div>
  );
}
