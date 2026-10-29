import { Suspense } from "react";

import AcceptInvitationClient from "./AcceptInvitationClient";
import { getT } from "../../i18n/server";
import styles from "./page.module.css";

export const metadata = {
  title: "Activate your account | Distinct Hospitality Solutions",
  description: "Activate the account you were invited to.",
};

export default async function AcceptInvitationPage() {
  const t = await getT("companyAdmin");
  return (
    <div className={styles.page}>
      <div className={`container ${styles.wrapper}`}>
        <h1 className={styles.h1}>{t("accept.pageTitle")}</h1>
        {/* useSearchParams exige un limite de Suspense en el App Router. */}
        <Suspense fallback={<p className={styles.estado}>{t("accept.loading")}</p>}>
          <AcceptInvitationClient />
        </Suspense>
      </div>
    </div>
  );
}
