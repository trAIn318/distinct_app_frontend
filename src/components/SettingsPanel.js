"use client";

/**
 * SettingsPanel — botón ⚙ en el navbar + slide-over de preferencias.
 *
 * Settings:
 *   - UI Language (English / Español) → se persiste ya; la traducción
 *     completa de la interfaz se conecta en la fase de i18n.
 *   - Theme (Dark / Light) → aplica en tiempo real vía [data-theme].
 *
 * Persistencia: localStorage (+cookie de idioma) siempre; si hay sesión,
 * sync con /api/user/preferences/ (el servidor gana al montar).
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  SUPPORTED_LANGUAGES,
  getStoredTheme,
  getStoredLanguage,
  setTheme as persistTheme,
  setLanguage as persistLanguage,
  applyTheme,
  loadServerPreferences,
} from "../lib/preferences";
import { useT } from "../i18n/client";
import styles from "./SettingsPanel.module.css";

export default function SettingsPanel() {
  const t = useT("settings");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [theme, setThemeState] = useState("dark");
  const [language, setLanguageState] = useState("en");

  // Estado inicial: local primero (sin parpadeo), luego servidor si hay sesión
  useEffect(() => {
    const localTheme = getStoredTheme();
    setThemeState(localTheme);
    applyTheme(localTheme);
    setLanguageState(getStoredLanguage());

    loadServerPreferences().then((prefs) => {
      if (!prefs) return;
      if (prefs.theme) setThemeState(prefs.theme);
      if (prefs.ui_language) setLanguageState(prefs.ui_language);
    });
  }, []);

  // Cerrar con Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const handleTheme = useCallback((t) => {
    setThemeState(t);
    persistTheme(t);
  }, []);

  const handleLanguage = useCallback(
    (code) => {
      setLanguageState(code);
      persistLanguage(code); // escribe cookie dx_lang + localStorage + sync API
      router.refresh(); // re-renderiza los server components en el nuevo idioma
    },
    [router]
  );

  return (
    <>
      <button
        type="button"
        className={styles.gearButton}
        onClick={() => setOpen(true)}
        aria-label="Settings"
        aria-expanded={open}
      >
        {/* Engranaje */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {/* Backdrop */}
      <div
        className={`${styles.backdrop} ${open ? styles.backdropOpen : ""}`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* Slide-over */}
      <aside
        className={`${styles.panel} ${open ? styles.panelOpen : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
      >
        <div className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>{t("title")}</h2>
          <button
            type="button"
            className={styles.closeButton}
            onClick={() => setOpen(false)}
            aria-label="Close settings"
          >
            ×
          </button>
        </div>

        <div className={styles.panelBody}>
          {/* ── Idioma ── */}
          <div className={styles.settingGroup}>
            <span className={styles.settingLabel}>{t("language")}</span>
            <div className={styles.segmented} role="radiogroup" aria-label="UI language">
              {SUPPORTED_LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  role="radio"
                  aria-checked={language === l.code}
                  className={`${styles.segment} ${language === l.code ? styles.segmentActive : ""}`}
                  onClick={() => handleLanguage(l.code)}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Tema ── */}
          <div className={styles.settingGroup}>
            <span className={styles.settingLabel}>{t("theme")}</span>
            <div className={styles.segmented} role="radiogroup" aria-label="Theme">
              <button
                type="button"
                role="radio"
                aria-checked={theme === "dark"}
                className={`${styles.segment} ${theme === "dark" ? styles.segmentActive : ""}`}
                onClick={() => handleTheme("dark")}
              >
                {t("dark")}
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={theme === "light"}
                className={`${styles.segment} ${theme === "light" ? styles.segmentActive : ""}`}
                onClick={() => handleTheme("light")}
              >
                {t("light")}
              </button>
            </div>
          </div>

          <p className={styles.note}>{t("note")}</p>
        </div>
      </aside>
    </>
  );
}
