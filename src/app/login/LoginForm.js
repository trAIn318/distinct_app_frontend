"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { loginApi, verifyLoginOtpApi, warmBackend } from "../../lib/api";
import { saveSession } from "../../lib/session";
import { loadServerPreferences } from "../../lib/preferences";
import styles from "./page.module.css";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams?.get("next") || "/";

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Paso 2 (inactividad): la cuenta requiere un código OTP enviado al email.
  const [awaitingOtp, setAwaitingOtp] = useState(false);
  const [otp, setOtp] = useState("");
  const [info, setInfo] = useState(null);
  // Aviso "el server está despertando" si la petición tarda (cold start).
  const [waking, setWaking] = useState(false);

  // Precalienta el backend al abrir el login: Render (free) duerme el servicio
  // y el primer acceso tarda ~30-60s en arrancar. Despertándolo mientras el
  // usuario escribe, el POST de login ya lo encuentra listo (evita el fallo
  // intermitente de CORS/ERR_FAILED por preflight perdido en el arranque).
  useEffect(() => {
    warmBackend();
  }, []);

  // Devuelve el id del timer que muestra el aviso de arranque a los 4s.
  function startWakingNotice() {
    setWaking(false);
    return setTimeout(() => setWaking(true), 4000);
  }

  // Completa el login una vez que tenemos tokens (login directo o tras OTP).
  async function finishLogin(data) {
    saveSession({
      access: data.access,
      refresh: data.refresh,
      user: data.user,
    });
    // Aplica inmediatamente las preferencias de la cuenta (idioma + tema):
    // el servidor manda sobre lo que hubiera elegido como invitado.
    await loadServerPreferences();
    router.push(nextPath);
    router.refresh();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!identifier.trim() || !password) {
      setError("Please enter your email/username and password.");
      return;
    }

    setLoading(true);
    const wakingTimer = startWakingNotice();
    try {
      const data = await loginApi(identifier.trim(), password);

      // El login devuelve 200 en varios estados que NO incluyen tokens.
      // Hay que ramificar; si no, "iniciamos sesión" sin token y caemos a home.
      if (data?.password_expired) {
        // Contraseña vencida → forzamos el flujo de reseteo (OTP) con el email.
        const email = data.email || identifier.trim();
        router.push(`/forgot-password?email=${encodeURIComponent(email)}&expired=1`);
        return;
      }
      if (data?.requires_otp) {
        // Segundo paso por inactividad: mostramos el input de código.
        setAwaitingOtp(true);
        setInfo("For your security, we sent a 6-digit code to your email. It expires in 10 minutes.");
        return;
      }
      if (data?.access) {
        await finishLogin(data);
        return;
      }
      // Respuesta inesperada (200 sin token ni estado conocido).
      setError("We couldn't sign you in. Please try again.");
    } catch (err) {
      setError(err.message || "Invalid credentials.");
    } finally {
      clearTimeout(wakingTimer);
      setWaking(false);
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    setError(null);

    if (!/^\d{6}$/.test(otp.trim())) {
      setError("Enter the 6-digit code from your email.");
      return;
    }

    setLoading(true);
    const wakingTimer = startWakingNotice();
    try {
      const data = await verifyLoginOtpApi(identifier.trim(), otp.trim());
      if (data?.access) {
        await finishLogin(data);
        return;
      }
      setError("We couldn't sign you in. Please try again.");
    } catch (err) {
      setError(err.message || "Invalid or expired code.");
    } finally {
      clearTimeout(wakingTimer);
      setWaking(false);
      setLoading(false);
    }
  }

  if (awaitingOtp) {
    return (
      <form className={styles.form} onSubmit={handleVerifyOtp} noValidate>
        {info && (
          <div className={styles.success} role="status">
            {info}
          </div>
        )}

        {waking && (
          <div className={styles.success} role="status">
            Connecting to the server… the first attempt can take a few seconds.
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
          {loading ? "Verifying…" : "Verify & sign in"}
        </button>

        <p className={styles.smallNote}>
          <button
            type="button"
            className={styles.inlineLink}
            onClick={() => {
              setAwaitingOtp(false);
              setOtp("");
              setInfo(null);
              setError(null);
            }}
          >
            Back to sign in
          </button>
        </p>
      </form>
    );
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Email or username</span>
        <input
          type="text"
          autoComplete="username"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          className={styles.input}
          required
          disabled={loading}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>Password</span>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={styles.input}
          required
          disabled={loading}
        />
      </label>

      {waking && (
        <div className={styles.success} role="status">
          Connecting to the server… the first attempt can take a few seconds.
        </div>
      )}

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
        {loading ? "Signing in…" : "Sign In"}
      </button>

      <p className={styles.smallNote}>
        <Link
          href={`/forgot-password${
            identifier.includes("@")
              ? `?email=${encodeURIComponent(identifier.trim())}`
              : ""
          }`}
          className={styles.inlineLink}
        >
          Forgot your password?
        </Link>
      </p>

      <p className={styles.smallNote}>
        Don&apos;t have an account?{" "}
        <Link href="/register" className={styles.inlineLink}>
          Sign up
        </Link>
      </p>
    </form>
  );
}
