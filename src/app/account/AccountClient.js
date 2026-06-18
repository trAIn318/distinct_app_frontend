"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { exportMyDataApi, deleteAccountApi } from "../../lib/api";
import { getCurrentUser, isAuthenticated, clearSession } from "../../lib/session";
import styles from "./account.module.css";

export default function AccountClient() {
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
      setExportError(err.message || "Could not export your data.");
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete(e) {
    e.preventDefault();
    setDeleteError(null);
    if (!password) {
      setDeleteError("Please confirm your password to continue.");
      return;
    }
    setDeleting(true);
    try {
      await deleteAccountApi(password);
      clearSession();
      router.replace("/?deleted=1");
      router.refresh();
    } catch (err) {
      setDeleteError(err.message || "Could not delete your account.");
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
        <h2 className={styles.cardTitle}>Profile</h2>
        {fullName && (
          <div className={styles.detail}>
            <span className={styles.detailLabel}>Name</span>
            <span className={styles.detailValue}>{fullName}</span>
          </div>
        )}
        <div className={styles.detail}>
          <span className={styles.detailLabel}>Username</span>
          <span className={styles.detailValue}>{user?.username}</span>
        </div>
        <div className={styles.detail}>
          <span className={styles.detailLabel}>Email</span>
          <span className={styles.detailValue}>{user?.email}</span>
        </div>
      </section>

      {/* Portabilidad — descargar mis datos */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Download my data</h2>
        <p className={styles.cardBody}>
          Export a copy of all the personal data we hold about you — your
          profile, your consent records, and any course enquiries — as a JSON
          file. (Right to data portability · Ley 1581 · CCPA/CPRA.)
        </p>
        {exportError && (
          <div className={styles.error} role="alert">
            {exportError}
          </div>
        )}
        {exportDone && (
          <div className={styles.success} role="status">
            Your data download has started.
          </div>
        )}
        <button
          type="button"
          className="btn-primary"
          onClick={handleExport}
          disabled={exporting}
        >
          {exporting ? "Preparing…" : "Download my data"}
        </button>
      </section>

      {/* Supresión — eliminar cuenta */}
      <section className={`${styles.card} ${styles.cardDanger}`}>
        <h2 className={styles.cardTitle}>Delete my account</h2>
        <p className={styles.cardBody}>
          Permanently delete your account and erase your personal data. This
          also withdraws your consent to data processing and cannot be undone.
          (Right to erasure · Ley 1581 · CCPA/CPRA.)
        </p>
        <button
          type="button"
          className={styles.dangerButton}
          onClick={() => {
            setDeleteError(null);
            setPassword("");
            setShowConfirm(true);
          }}
        >
          Delete my account
        </button>
      </section>

      <p className={styles.cardBody}>
        Read how we handle your data in our{" "}
        <Link href="/privacy-policy" style={{ color: "var(--color-gold)" }}>
          Privacy Policy
        </Link>
        .
      </p>

      {/* Modal de confirmación */}
      {showConfirm && (
        <div
          className={styles.modalOverlay}
          role="dialog"
          aria-modal="true"
          aria-label="Confirm account deletion"
        >
          <form className={styles.modal} onSubmit={handleDelete} noValidate>
            <h2 className={styles.cardTitle}>Confirm deletion</h2>
            <p className={styles.cardBody}>
              Enter your current password to confirm. This permanently erases
              your personal data.
            </p>
            {deleteError && (
              <div className={styles.error} role="alert">
                {deleteError}
              </div>
            )}
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Current password</span>
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
                Cancel
              </button>
              <button
                type="submit"
                className={styles.dangerButton}
                disabled={deleting}
              >
                {deleting ? "Deleting…" : "Delete forever"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
