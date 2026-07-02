"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { requestPasswordResetApi, resetPasswordApi } from "../../lib/api";
import { useT } from "../../i18n/client";
import styles from "./page.module.css";

export default function ForgotPasswordForm() {
  const t = useT("forgotPassword");
  const router = useRouter();
  const searchParams = useSearchParams();

  // Paso 1 ("email") pide el correo; paso 2 ("reset") pide OTP + nueva clave.
  const [step, setStep] = useState("email");

  const [email, setEmail] = useState(searchParams?.get("email") || "");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Si llegamos desde un login con contraseña vencida, explicamos por qué.
  const [info, setInfo] = useState(
    searchParams?.get("expired") === "1" ? t("infoExpired") : null
  );

  async function handleRequest(e) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!email.trim()) {
      setError(t("errEmail"));
      return;
    }

    setLoading(true);
    try {
      await requestPasswordResetApi(email.trim());
      // El backend responde igual exista o no la cuenta. Avanzamos al paso 2.
      setStep("reset");
      setInfo(t("infoSent"));
    } catch (err) {
      setError(err.message || t("errStart"));
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      await requestPasswordResetApi(email.trim());
      setInfo(t("infoResent"));
    } catch (err) {
      setError(err.message || t("errResend"));
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!/^\d{6}$/.test(otp.trim())) {
      setError(t("errCode"));
      return;
    }
    if (newPassword.length < 8) {
      setError(t("errPasswordLen"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t("errPasswordMatch"));
      return;
    }

    setLoading(true);
    try {
      await resetPasswordApi({
        email: email.trim(),
        otp: otp.trim(),
        newPassword,
        confirmPassword,
      });
      setInfo(t("infoUpdated"));
      setTimeout(() => router.push("/login"), 1200);
    } catch (err) {
      setError(err.message || t("errReset"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className={styles.steps}>
        <span className={step === "email" ? styles.stepActive : undefined}>
          {t("step1")}
        </span>
        <span className={styles.stepDivider} aria-hidden="true" />
        <span className={step === "reset" ? styles.stepActive : undefined}>
          {t("step2")}
        </span>
      </div>

      {step === "email" ? (
        <form className={styles.form} onSubmit={handleRequest} noValidate>
          {info && (
            <div className={styles.success} role="status">
              {info}
            </div>
          )}

          <label className={styles.field}>
            <span className={styles.fieldLabel}>{t("email")}</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
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
            {loading ? t("sendLoading") : t("send")}
          </button>

          <p className={styles.smallNote}>
            {t("rememberedPre")}{" "}
            <Link href="/login" className={styles.inlineLink}>
              {t("backToSignIn")}
            </Link>
          </p>
        </form>
      ) : (
        <form className={styles.form} onSubmit={handleReset} noValidate>
          {info && (
            <div className={styles.success} role="status">
              {info}
            </div>
          )}

          <label className={styles.field}>
            <span className={styles.fieldLabel}>{t("otpLabel")}</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              className={`${styles.input} ${styles.otpInput}`}
              required
              disabled={loading}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>{t("newPassword")}</span>
            <input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={styles.input}
              required
              disabled={loading}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>{t("confirmPassword")}</span>
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={styles.input}
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
            {loading ? t("updateLoading") : t("update")}
          </button>

          <p className={styles.smallNote}>
            {t("noCodePre")}{" "}
            <button
              type="button"
              className={styles.linkButton}
              onClick={handleResend}
              disabled={loading}
            >
              {t("resend")}
            </button>
          </p>
        </form>
      )}
    </>
  );
}
