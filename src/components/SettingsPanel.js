"use client";

/**
 * SettingsPanel — engranaje ⚙ como panel deslizante desde la derecha.
 * Contiene secciones plegables:
 *   - RECLUTADOR: accesos del grupo RECRUITER del rol (→ /coming-soon).
 *   - CONFIGURACIÓN: accesos del grupo SETTINGS (→ /coming-soon) + los
 *     controles reales de Idioma y Tema.
 * Sin sesión (menu vacío) muestra solo Idioma + Tema.
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
import { splitMenuByGroup, resolveMenuTarget, getMenuLabel } from "../lib/menuTargets";
import NavDrawer from "./NavDrawer";
import { useT } from "../i18n/client";
import styles from "./SettingsPanel.module.css";

export default function SettingsPanel({ menu = [] }) {
  const t = useT("settings");
  const tMenu = useT("menu");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [theme, setThemeState] = useState("dark");
  const [language, setLanguageState] = useState("en");

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

  // Permite abrir el panel desde otros componentes (compat con acceso "Language")
  useEffect(() => {
    const openPanel = () => setOpen(true);
    window.addEventListener("distinct:open-settings", openPanel);
    return () => window.removeEventListener("distinct:open-settings", openPanel);
  }, []);

  const handleTheme = useCallback((val) => {
    setThemeState(val);
    persistTheme(val);
  }, []);

  const handleLanguage = useCallback(
    (code) => {
      setLanguageState(code);
      persistLanguage(code);
      router.refresh();
    },
    [router]
  );

  const grouped = splitMenuByGroup(menu);
  const settingsLinks = grouped.settings.filter(
    (it) => resolveMenuTarget(it.url).type === "route"
  );

  const gearIcon = (
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
  );

  return (
    <NavDrawer
      open={open}
      onOpenChange={setOpen}
      label={t("title")}
      width="min(380px, 92vw)"
      triggerClassName={styles.gearButton}
      trigger={gearIcon}
    >
      <>
        {grouped.recruiter.length > 0 && (
          <details className={styles.section} open>
            <summary className={styles.sectionSummary}>{t("recruiter")}</summary>
            <ul className={styles.linkList}>
              {grouped.recruiter.map((it) => (
                <li key={it.url}>
                  <a className={styles.link} href={resolveMenuTarget(it.url).href}>
                    {getMenuLabel(it, tMenu)}
                  </a>
                </li>
              ))}
            </ul>
          </details>
        )}

        <details className={styles.section} open>
          <summary className={styles.sectionSummary}>{t("title")}</summary>

          {settingsLinks.length > 0 && (
            <ul className={styles.linkList}>
              {settingsLinks.map((it) => (
                <li key={it.url}>
                  <a className={styles.link} href={resolveMenuTarget(it.url).href}>
                    {getMenuLabel(it, tMenu)}
                  </a>
                </li>
              ))}
            </ul>
          )}

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
        </details>
      </>
    </NavDrawer>
  );
}
