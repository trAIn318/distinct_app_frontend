"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { loginApi } from "../../lib/api";
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

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!identifier.trim() || !password) {
      setError("Please enter your email/username and password.");
      return;
    }

    setLoading(true);
    try {
      const data = await loginApi(identifier.trim(), password);
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
    } catch (err) {
      setError(err.message || "Invalid credentials.");
    } finally {
      setLoading(false);
    }
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
        Don&apos;t have an account?{" "}
        <Link href="/register" className={styles.inlineLink}>
          Sign up
        </Link>
      </p>
    </form>
  );
}
