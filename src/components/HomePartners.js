/**
 * HomePartners
 * Sección "Our Partners" al final de la home. Server component:
 * fetchea /api/partners/ en SSR. Si no hay partners o el backend no
 * responde, la sección no se renderiza.
 *
 * Los logos vienen como filename en la DB y se sirven desde los
 * estáticos del backend (ver resolvePartnerLogo en lib/config).
 */

import { getPartners } from "../lib/api";
import { resolvePartnerLogo } from "../lib/config";
import { getT } from "../i18n/server";
import Reveal from "./Reveal";
import styles from "./HomePartners.module.css";

export default async function HomePartners() {
  const t = await getT("partners");
  const partners = await getPartners().catch(() => []);

  if (!partners || partners.length === 0) {
    return null;
  }

  return (
    <section className={styles.section} aria-labelledby="partners-heading">
      <div className="container">
        <Reveal>
          <span className={styles.eyebrow}>{t("eyebrow")}</span>
          <h2 id="partners-heading" className={styles.headline}>
            {t("titlePre")}{" "}
            <span className="emphasized gold">{t("titleEmphasis")}</span>
            {t("titlePost")}
          </h2>
        </Reveal>

        <Reveal group className={styles.grid}>
          {partners.map((p) => {
            const logo = resolvePartnerLogo(p.partner_logo_url);
            return (
              <a
                key={p.id}
                href={p.partner_web_url || "#"}
                className={styles.card}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={p.partner_name}
                title={p.partner_description || p.partner_name}
              >
                {logo ? (
                  <img
                    src={logo}
                    alt={`${p.partner_name} logo`}
                    className={styles.logo}
                    loading="lazy"
                  />
                ) : (
                  <span className={styles.fallbackName}>{p.partner_name}</span>
                )}
                <span className={styles.name}>{p.partner_name}</span>
              </a>
            );
          })}
        </Reveal>
      </div>
    </section>
  );
}
