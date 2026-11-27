"use client";

/**
 * SettingsPanel — engranaje ⚙ como panel deslizante desde la derecha.
 *
 * Repite la estructura del Tablero (`DashboardMenu`), que es la referencia de
 * los paneles laterales: SETTINGS como título arriba, los accesos a OTRAS
 * pantallas como chips en la cabecera, y debajo lo que se maneja aquí dentro.
 *   - cabecera: accesos del grupo SETTINGS con pantalla propia (Admin Company).
 *   - cuerpo: accesos del grupo RECRUITER + los controles de Idioma y Tema.
 * Sin sesión (menu vacío) muestra solo Idioma + Tema.
 *
 * POR QUÉ NO ES UN PLEGABLE NI UNAS PESTAÑAS. Admin Company se pintaba como
 * texto platino plano dentro de un <details>, debajo de los toggles, y la
 * dirección reportó que "pasa desapercibido; en la primera revisión no se vio".
 * El chip dorado lo arregla. Idioma y Tema se quedan los DOS a la vista, sin un
 * clic previo que los seleccione: cambiar el idioma es la acción más frecuente
 * del panel y costaba un clic, no dos. Decisión del usuario, 2026-11-27.
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
import MenuIcon from "./MenuIcon";
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

  // Misma fila de chips en la cabecera y en el bloque de Reclutador: el estilo
  // es la clase global `chip-nav`, compartida con el Tablero.
  const filaDeChips = (items) => (
    <ul className={styles.chipRow}>
      {items.map((it) => (
        <li key={it.url}>
          <a className="chip-nav" href={resolveMenuTarget(it.url).href}>
            <MenuIcon icon={it.icon} className="chip-nav__icon" />
            <span>{getMenuLabel(it, tMenu)}</span>
          </a>
        </li>
      ))}
    </ul>
  );

  return (
    <NavDrawer
      open={open}
      onOpenChange={setOpen}
      label={t("title")}
      title={t("title")}
      titleTone="gold"
      width="min(380px, 92vw)"
      triggerClassName={styles.gearButton}
      trigger={gearIcon}
      headerActions={settingsLinks.length > 0 ? filaDeChips(settingsLinks) : null}
    >
      <>
        {grouped.recruiter.length > 0 && (
          <section className={styles.block}>
            <h3 className={styles.blockLabel}>{t("recruiter")}</h3>
            {filaDeChips(grouped.recruiter)}
          </section>
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
      </>
    </NavDrawer>
  );
}
