"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { registerApi } from "../../lib/api";
import { saveSession } from "../../lib/session";
import styles from "../login/page.module.css";
import registerStyles from "./register.module.css";

/**
 * RegisterForm — formulario de registro con consent obligatorio.
 *
 * Props:
 *   policy: { policy_id, policy_version, policy_text } | null
 */
export default function RegisterForm({ policy }) {
  const router = useRouter();

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    username: "",
    email: "",
    phone: "",
    password: "",
    confirm_password: "",
    accept_policy: false,
  });
  const [showPolicy, setShowPolicy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function validate() {
    if (!form.username.trim() || form.username.length < 3) {
      return "Username must be at least 3 characters.";
    }
    if (!form.email.includes("@")) {
      return "Please enter a valid email address.";
    }
    if (form.password.length < 8) {
      return "Password must be at least 8 characters.";
    }
    if (form.password !== form.confirm_password) {
      return "Passwords do not match.";
    }
    if (!form.accept_policy) {
      return "You must accept the Data Processing Policy to continue.";
    }
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setLoading(true);
    try {
      const data = await registerApi({
        username: form.username.trim(),
        email: form.email.trim().toLowerCase(),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        phone: form.phone.trim(),
        password: form.password,
        confirm_password: form.confirm_password,
        accept_policy: true,
      });
      saveSession({
        access: data.access,
        refresh: data.refresh,
        user: data.user,
      });
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={registerStyles.row2}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>First name</span>
            <input
              type="text"
              value={form.first_name}
              onChange={(e) => update("first_name", e.target.value)}
              className={styles.input}
              autoComplete="given-name"
              disabled={loading}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Last name</span>
            <input
              type="text"
              value={form.last_name}
              onChange={(e) => update("last_name", e.target.value)}
              className={styles.input}
              autoComplete="family-name"
              disabled={loading}
            />
          </label>
        </div>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Username</span>
          <input
            type="text"
            value={form.username}
            onChange={(e) => update("username", e.target.value)}
            className={styles.input}
            autoComplete="username"
            required
            minLength={3}
            disabled={loading}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Email</span>
          <input
            type="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            className={styles.input}
            autoComplete="email"
            required
            disabled={loading}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Phone (optional)</span>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
            className={styles.input}
            autoComplete="tel"
            disabled={loading}
          />
        </label>

        <div className={registerStyles.row2}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Password</span>
            <input
              type="password"
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              className={styles.input}
              autoComplete="new-password"
              required
              minLength={8}
              disabled={loading}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Confirm password</span>
            <input
              type="password"
              value={form.confirm_password}
              onChange={(e) => update("confirm_password", e.target.value)}
              className={styles.input}
              autoComplete="new-password"
              required
              minLength={8}
              disabled={loading}
            />
          </label>
        </div>

        {/* Consent — Habeas Data CO (Ley 1581) + CCPA US */}
        <label className={registerStyles.consent}>
          <input
            type="checkbox"
            checked={form.accept_policy}
            onChange={(e) => update("accept_policy", e.target.checked)}
            disabled={loading}
            required
          />
          <span>
            I have read and accept the{" "}
            <button
              type="button"
              className={registerStyles.policyLink}
              onClick={() => setShowPolicy(true)}
            >
              Data Processing Policy
            </button>
            {policy?.policy_version ? ` (v${policy.policy_version})` : ""}.
          </span>
        </label>

        {error && (
          <div className={styles.error} role="alert">
            {error}
          </div>
        )}

        <button
          type="submit"
          className="btn-primary"
          disabled={loading}
          style={{ width: "100%", marginTop: "var(--space-2)" }}
        >
          {loading ? "Creating account…" : "Create Account"}
        </button>

        <p className={styles.smallNote}>
          Already have an account?{" "}
          <Link href="/login" className={styles.inlineLink}>
            Sign in
          </Link>
        </p>
      </form>

      {/* Policy modal */}
      {showPolicy && (
        <div
          className={registerStyles.modalOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="policy-title"
          onClick={() => setShowPolicy(false)}
        >
          <div
            className={registerStyles.modal}
            onClick={(e) => e.stopPropagation()}
          >
            <header className={registerStyles.modalHeader}>
              <h2 id="policy-title" className={registerStyles.modalTitle}>
                Data Processing Policy
                {policy?.policy_version ? ` — v${policy.policy_version}` : ""}
              </h2>
              <button
                type="button"
                className={registerStyles.modalClose}
                onClick={() => setShowPolicy(false)}
                aria-label="Close"
              >
                ×
              </button>
            </header>
            <div className={registerStyles.modalBody}>
              {policy?.policy_text ? (
                <pre className={registerStyles.policyText}>
                  {policy.policy_text}
                </pre>
              ) : (
                <p>
                  The policy text is currently being loaded. By continuing you
                  agree to our data processing practices in accordance with
                  Colombia&apos;s Habeas Data Law (Ley 1581/2012) and applicable
                  US privacy laws (including CCPA).
                </p>
              )}
            </div>
            <footer className={registerStyles.modalFooter}>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setShowPolicy(false)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  update("accept_policy", true);
                  setShowPolicy(false);
                }}
              >
                I Accept
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
