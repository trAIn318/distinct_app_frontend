/**
 * src/lib/preferences.js
 * Preferencias de UI (tema + idioma) — client-side.
 *
 * Persistencia:
 *   - Invitados: localStorage (+ cookie dx_lang para que el server pueda
 *     renderizar en el idioma correcto en la Fase 3 de i18n).
 *   - Autenticados: igual que invitados + sync con
 *     PUT /api/user/preferences/ (el servidor es la fuente de verdad
 *     entre dispositivos).
 *
 * Parametrizable: para añadir un idioma, agregarlo a SUPPORTED_LANGUAGES
 * aquí y a VALID_UI_LANGUAGES en el backend, y crear su archivo de
 * traducciones (Fase 3).
 */

import { API_URL } from "./config";
import { getAccessToken } from "./session";

export const THEME_KEY = "dx_theme";
export const LANG_KEY = "dx_lang";

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
];

export const SUPPORTED_THEMES = ["dark", "light"];

const isBrowser = () => typeof window !== "undefined";

// ── Tema ───────────────────────────────────────────────────────────────────

export function getStoredTheme() {
  if (!isBrowser()) return "dark";
  try {
    const t = localStorage.getItem(THEME_KEY);
    return SUPPORTED_THEMES.includes(t) ? t : "dark";
  } catch {
    return "dark";
  }
}

/** Aplica el tema al DOM (dark = sin atributo, es el default del CSS). */
export function applyTheme(theme) {
  if (!isBrowser()) return;
  if (theme === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

export function setTheme(theme) {
  if (!SUPPORTED_THEMES.includes(theme)) return;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {}
  applyTheme(theme);
  syncToServer({ theme });
}

// ── Idioma ─────────────────────────────────────────────────────────────────

/**
 * Idioma efectivo: preferencia guardada > idioma del navegador > 'en'.
 * La detección del navegador solo aplica si el usuario nunca eligió.
 */
export function getStoredLanguage() {
  if (!isBrowser()) return "en";
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved && SUPPORTED_LANGUAGES.some((l) => l.code === saved)) {
      return saved;
    }
  } catch {}
  return detectBrowserLanguage();
}

export function detectBrowserLanguage() {
  if (!isBrowser()) return "en";
  const nav = (navigator.language || "en").toLowerCase();
  return nav.startsWith("es") ? "es" : "en";
}

export function setLanguage(code) {
  if (!SUPPORTED_LANGUAGES.some((l) => l.code === code)) return;
  try {
    localStorage.setItem(LANG_KEY, code);
  } catch {}
  // Cookie legible por el server — la Fase 3 (i18n SSR) renderiza con ella
  document.cookie = `${LANG_KEY}=${code}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  syncToServer({ ui_language: code });
}

// ── Sync con el backend (solo autenticados; best-effort) ──────────────────

async function syncToServer(partial) {
  const token = getAccessToken();
  if (!token) return;
  try {
    await fetch(`${API_URL}/api/user/preferences/`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(partial),
    });
  } catch {
    // Sin red o backend caído: la preferencia local sigue aplicada.
  }
}

/**
 * Carga las preferencias del servidor (si hay sesión) y las aplica.
 * El servidor gana sobre lo local — mantiene consistencia entre dispositivos.
 * Devuelve {ui_language, theme} efectivos.
 */
export async function loadServerPreferences() {
  const token = getAccessToken();
  if (!token) return null;
  try {
    const res = await fetch(`${API_URL}/api/user/preferences/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const prefs = await res.json();
    if (prefs.theme && SUPPORTED_THEMES.includes(prefs.theme)) {
      try {
        localStorage.setItem(THEME_KEY, prefs.theme);
      } catch {}
      applyTheme(prefs.theme);
    }
    if (prefs.ui_language) {
      try {
        localStorage.setItem(LANG_KEY, prefs.ui_language);
      } catch {}
      document.cookie = `${LANG_KEY}=${prefs.ui_language}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    }
    return prefs;
  } catch {
    return null;
  }
}
