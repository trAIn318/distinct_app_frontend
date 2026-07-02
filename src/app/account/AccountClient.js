"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { exportMyDataApi, deleteAccountApi } from "../../lib/api";
import { getCurrentUser, isAuthenticated, clearSession } from "../../lib/session";
import { useT } from "../../i18n/client";
import styles from "./account.module.css";

export default function AccountClient() {
  const t = useT("account");
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);
  const [exportDone, setExportDone] = useState(false);

  const [showConfirm, setShowConfirm] = useState(false);
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  // Esta página es privada: si no hay sesión, mandamos a login con ?next=.
  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login?next=/account");
      return;
    }
    setUser(getCurrentUser());
    setReady(true);
  }, [router]);

  if (!ready) return null;

  async function handleExport() {
    setExportError(null);
    setExportDone(false);
    setExporting(true);
    try {
      const data = await exportMyDataApi();
      // Descarga el JSON como archivo local.
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "distinct-my-data.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setExportDone(true);
    } catch (err) {
      setExportError(err.message || t("errExport"));
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete(e) {
    e.preventDefault();
    setDeleteError(null);
    if (!password) {
      setDeleteError(t("errPassword"));
      return;
    }
    setDeleting(true);
    try {
      await deleteAccountApi(password);
      clearSession();
      router.replace("/?deleted=1");
      router.refresh();
    } catch (err) {
      setDeleteError(err.message || t("errDelete"));
      setDeleting(false);
    }
  }

  const fullName = [user?.first_name, user?.last_name]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      {/* Datos de la cuenta */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>{t("profile")}</h2>
        {fullName && (
          <div className={styles.detail}>
            <span className={styles.detailLabel}>{t("name")}</span>
            <span className={styles.detailValue}>{fullName}</span>
          </div>
        )}
        <div className={styles.detail}>
          <span className={styles.detailLabel}>{t("username")}</span>
          <span className={styles.detailValue}>{user?.username}</span>
        </div>
        <div className={styles.detail}>
          <span className={styles.detailLabel}>{t("email")}</span>
          <span className={styles.detailValue}>{user?.email}</span>
        </div>
      </section>

      {/* Portabilidad — descargar mis datos */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>{t("downloadTitle")}</h2>
        <p className={styles.cardBody}>{t("downloadBody")}</p>
        {exportError && (
          <div className={styles.error} role="alert">
            {exportError}
          </div>
        )}
        {exportDone && (
          <div className={styles.success} role="status">
            {t("downloadStarted")}
          </div>
        )}
        <button
          type="button"
          className="btn-primary"
          onClick={handleExport}
          disabled={exporting}
        >
          {exporting ? t("downloadLoading") : t("downloadBtn")}
        </button>
      </section>

      {/* Supresión — eliminar cuenta */}
      <section className={`${styles.card} ${styles.cardDanger}`}>
        <h2 className={styles.cardTitle}>{t("deleteTitle")}</h2>
        <p className={styles.cardBody}>{t("deleteBody")}</p>
        <button
          type="button"
          className={styles.dangerButton}
          onClick={() => {
            setDeleteError(null);
            setPassword("");
            setShowConfirm(true);
          }}
        >
          {t("deleteBtn")}
        </button>
      </section>

      <p className={styles.cardBody}>
        {t("privacyPre")}
        <Link href="/privacy-policy" style={{ color: "var(--color-gold)" }}>
          {t("privacyLink")}
        </Link>
        .
      </p>

      {/* Modal de confirmación */}
      {showConfirm && (
        <div
          className={styles.modalOverlay}
          role="dialog"
          aria-modal="true"
          aria-label={t("confirmAria")}
        >
          <form className={styles.modal} onSubmit={handleDelete} noValidate>
            <h2 className={styles.cardTitle}>{t("confirmTitle")}</h2>
            <p className={styles.cardBody}>{t("confirmBody")}</p>
            {deleteError && (
              <div className={styles.error} role="alert">
                {deleteError}
              </div>
            )}
            <label className={styles.field}>
              <span className={styles.fieldLabel}>{t("currentPassword")}</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={styles.input}
                required
                disabled={deleting}
              />
            </label>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.ghostButton}
                onClick={() => setShowConfirm(false)}
                disabled={deleting}
              >
                {t("cancel")}
              </button>
              <button
                type="submit"
                className={styles.dangerButton}
                disabled={deleting}
              >
                {deleting ? t("deleteLoading") : t("deleteForever")}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
