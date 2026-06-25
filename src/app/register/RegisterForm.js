"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { registerApi, verifyRegisterOtpApi } from "../../lib/api";
import { saveSession } from "../../lib/session";
import { useT } from "../../i18n/client";
import styles from "../login/page.module.css";
import registerStyles from "./register.module.css";

/**
 * RegisterForm — formulario de registro con consent obligatorio.
 *
 * Props:
 *   policy: { policy_id, policy_version, policy_text } | null
 */
export default function RegisterForm({ policy }) {
  const t = useT("register");
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

  // Paso "form" pide los datos; paso "otp" pide el código de activación.
  const [step, setStep] = useState("form");
  const [otp, setOtp] = useState("");
  const [info, setInfo] = useState(null);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function validate() {
    if (!form.username.trim() || form.username.length < 3) {
      return t("errUsername");
    }
    if (!form.email.includes("@")) {
      return t("errEmail");
    }
    if (form.password.length < 8) {
      return t("errPassword");
    }
    if (form.password !== form.confirm_password) {
      return t("errPasswordMatch");
    }
    if (!form.accept_policy) {
      return t("errPolicy");
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
      await registerApi(registerPayload());
      // El backend NO entrega sesión todavía: exige activación por OTP.
      setStep("otp");
      setInfo(t("otpInfo"));
    } catch (err) {
      setError(err.message || t("errRegister"));
    } finally {
      setLoading(false);
    }
  }

  function registerPayload() {
    return {
      username: form.username.trim(),
      email: form.email.trim().toLowerCase(),
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      phone: form.phone.trim(),
      password: form.password,
      confirm_password: form.confirm_password,
      accept_policy: true,
    };
  }

  async function handleVerify(e) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!/^\d{6}$/.test(otp.trim())) {
      setError(t("errCode"));
      return;
    }
    setLoading(true);
    try {
      const data = await verifyRegisterOtpApi(
        form.email.trim().toLowerCase(),
        otp.trim()
      );
      saveSession({
        access: data.access,
        refresh: data.refresh,
        user: data.user,
      });
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err.message || t("errVerify"));
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      // Reenviar el registro de una cuenta sin confirmar reemite el OTP.
      await registerApi(registerPayload());
      setInfo(t("otpResent"));
    } catch (err) {
      setError(err.message || t("errResend"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className={registerStyles.steps}>
        <span className={step === "form" ? registerStyles.stepActive : undefined}>
          {t("step1")}
        </span>
        <span className={registerStyles.stepDivider} aria-hidden="true" />
        <span className={step === "otp" ? registerStyles.stepActive : undefined}>
          {t("step2")}
        </span>
      </div>

      {step === "form" ? (
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={registerStyles.row2}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>{t("firstName")}</span>
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
            <span className={styles.fieldLabel}>{t("lastName")}</span>
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
          <span className={styles.fieldLabel}>{t("username")}</span>
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
          <span className={styles.fieldLabel}>{t("email")}</span>
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
          <span className={styles.fieldLabel}>{t("phone")}</span>
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
            <span className={styles.fieldLabel}>{t("password")}</span>
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
            <span className={styles.fieldLabel}>{t("confirmPassword")}</span>
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
            {t("consentPre")}{" "}
            <button
              type="button"
              className={registerStyles.policyLink}
              onClick={() => setShowPolicy(true)}
            >
              {t("consentLink")}
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
          {loading ? t("submitLoading") : t("submit")}
        </button>

        <p className={styles.smallNote}>
          {t("haveAccount")}{" "}
          <Link href="/login" className={styles.inlineLink}>
            {t("signIn")}
          </Link>
        </p>
      </form>
      ) : (
      <form className={styles.form} onSubmit={handleVerify} noValidate>
        {info && (
          <div className={registerStyles.success} role="status">
            {info}
          </div>
        )}

        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t("code")}</span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            className={`${styles.input} ${registerStyles.otpInput}`}
            required
            disabled={loading}
          />
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
          {loading ? t("verifyLoading") : t("verify")}
        </button>

        <p className={styles.smallNote}>
          {t("noCode")}{" "}
          <button
            type="button"
            className={registerStyles.linkButton}
            onClick={handleResend}
            disabled={loading}
          >
            {t("resend")}
          </button>
        </p>
      </form>
      )}

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
                {t("modalTitle")}
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
                <p>{t("modalFallback")}</p>
              )}
            </div>
            <footer className={registerStyles.modalFooter}>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setShowPolicy(false)}
              >
                {t("close")}
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  update("accept_policy", true);
                  setShowPolicy(false);
                }}
              >
                {t("accept")}
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
