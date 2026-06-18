"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { requestPasswordResetApi, resetPasswordApi } from "../../lib/api";
import styles from "./page.module.css";

export default function ForgotPasswordForm() {
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
  const [info, setInfo] = useState(null);

  async function handleRequest(e) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!email.trim()) {
      setError("Please enter the email associated with your account.");
      return;
    }

    setLoading(true);
    try {
      await requestPasswordResetApi(email.trim());
      // El backend responde igual exista o no la cuenta. Avanzamos al paso 2.
      setStep("reset");
      setInfo("If that email exists, we sent a 6-digit code. It expires in 10 minutes.");
    } catch (err) {
      setError(err.message || "Could not start password reset.");
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
      setInfo("A new code is on its way. It expires in 10 minutes.");
    } catch (err) {
      setError(err.message || "Could not resend the code.");
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!/^\d{6}$/.test(otp.trim())) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Your new password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The passwords do not match.");
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
      setInfo("Password updated. Redirecting you to sign in…");
      setTimeout(() => router.push("/login"), 1200);
    } catch (err) {
      setError(err.message || "Could not reset password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className={styles.steps}>
        <span className={step === "email" ? styles.stepActive : undefined}>
          1 · Email
        </span>
        <span className={styles.stepDivider} aria-hidden="true" />
        <span className={step === "reset" ? styles.stepActive : undefined}>
          2 · New password
        </span>
      </div>

      {step === "email" ? (
        <form className={styles.form} onSubmit={handleRequest} noValidate>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Email</span>
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
            {loading ? "Sending…" : "Send reset code"}
          </button>

          <p className={styles.smallNote}>
            Remembered it?{" "}
            <Link href="/login" className={styles.inlineLink}>
              Back to sign in
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
            <span className={styles.fieldLabel}>6-digit code</span>
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
            <span className={styles.fieldLabel}>New password</span>
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
            <span className={styles.fieldLabel}>Confirm new password</span>
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
            {loading ? "Updating…" : "Update password"}
          </button>

          <p className={styles.smallNote}>
            Didn&apos;t get a code?{" "}
            <button
              type="button"
              className={styles.linkButton}
              onClick={handleResend}
              disabled={loading}
            >
              Resend
            </button>
          </p>
        </form>
      )}
    </>
  );
}
