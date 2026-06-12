"use client";

import { useState } from "react";
import { useT } from "../i18n/client";
import styles from "./TeamCard.module.css";

export default function TeamCard({ image, name, role, bio, email }) {
  const t = useT("team");
  const [expanded, setExpanded] = useState(false);

  return (
    <article className={styles.teamCard}>
      <div className={styles.teamImageWrapper}>
        <img src={image} alt={`${name} — ${role}`} className={styles.teamImage} loading="lazy" />
      </div>
      <h3 className={styles.teamName}>{name}</h3>
      <span className={styles.teamRole}>{role}</span>
      
      <a href={`mailto:${email}`} className={styles.teamEmail}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
        {email}
      </a>

      <button 
        className={styles.expandButton} 
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        {expanded ? t("hideBio") : t("readBio")}
        <svg 
          className={`${styles.chevron} ${expanded ? styles.expanded : ""}`} 
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      <div className={`${styles.bioWrapper} ${expanded ? styles.bioExpanded : ""}`}>
        <p className={styles.teamBio}>{bio}</p>
      </div>
    </article>
  );
}
