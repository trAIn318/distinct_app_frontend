import Link from "next/link";
import { getFormPolicy } from "../../lib/api";
import styles from "../privacy-policy/page.module.css";

export const metadata = {
  title: "Cookie Policy | Distinct Hospitality Solutions",
  description:
    "How Distinct Hospitality Solutions uses cookies — compliant with Colombia's Ley 1581/2012 and applicable US privacy laws (CCPA).",
};

export default async function CookiePolicy() {
  const policy = await getFormPolicy("cookie").catch(() => null);

  return (
    <div className={styles.page}>
      <main className="container">
        <div className={styles.content}>
          <span className={styles.eyebrow}>Legal</span>
          <h1 className={styles.headline}>Cookie Policy</h1>

          {policy?.form_purpose ? (
            <article className={styles.policyArticle}>
              {policy.form_purpose}
            </article>
          ) : (
            <p className={styles.bodyCopy}>
              This site uses only essential cookies required to keep you signed
              in and to remember your language and theme preferences. We do not
              use advertising or third-party tracking cookies. See our{" "}
              <Link href="/privacy-policy" style={{ color: "var(--color-gold)" }}>
                Privacy Policy
              </Link>{" "}
              for how we handle your personal data.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
