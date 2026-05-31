import { getActivePolicy } from "../../lib/api";
import styles from "./page.module.css";

export const metadata = {
  title: "Privacy Policy | Distinct Hospitality Solutions",
  description:
    "Data Processing Policy for Distinct Hospitality Solutions — compliant with Colombia's Ley 1581/2012 (Habeas Data) and applicable US privacy laws (CCPA).",
};

export default async function PrivacyPolicy() {
  const policy = await getActivePolicy().catch(() => null);

  return (
    <div className={styles.page}>
      <main className="container">
        <div className={styles.content}>
          <span className={styles.eyebrow}>Legal</span>
          <h1 className={styles.headline}>
            Data Processing Policy
            {policy?.policy_version ? ` — v${policy.policy_version}` : ""}
          </h1>
          {policy?.policy_start_date && (
            <p className={styles.metaCopy}>
              Effective from{" "}
              {new Date(policy.policy_start_date).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          )}

          {policy?.policy_text ? (
            <article className={styles.policyArticle}>
              {policy.policy_text}
            </article>
          ) : (
            <p className={styles.bodyCopy}>
              The full policy text is being updated. By using our services, you
              agree to our data processing practices in accordance with
              Colombia&apos;s Habeas Data Law (Ley 1581 of 2012) and
              applicable US privacy laws (including CCPA).
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
