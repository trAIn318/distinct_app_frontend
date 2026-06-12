/**
 * src/i18n/server.js
 * i18n para SERVER components.
 *
 * Resolución del idioma (en orden):
 *   1. Cookie `dx_lang` — la escribe el panel ⚙ (elección manual del usuario)
 *      y/o loadServerPreferences (preferencia de cuenta).
 *   2. Header Accept-Language — idioma del navegador/sistema del visitante
 *      (detección automática en la primera visita).
 *   3. 'en' por defecto.
 *
 * Para añadir un idioma: crear messages/<código>.json, registrarlo en
 * MESSAGES y SUPPORTED_LOCALES aquí, en SUPPORTED_LANGUAGES de
 * lib/preferences.js y en VALID_UI_LANGUAGES del backend.
 */

import { cookies, headers } from "next/headers";
import { makeT } from "./t";
import en from "./messages/en.json";
import es from "./messages/es.json";

export const SUPPORTED_LOCALES = ["en", "es"];
export const DEFAULT_LOCALE = "en";

const MESSAGES = { en, es };

export async function getLocale() {
  // 1. Preferencia explícita (cookie)
  try {
    const store = await cookies();
    const saved = store.get("dx_lang")?.value;
    if (saved && SUPPORTED_LOCALES.includes(saved)) return saved;
  } catch {}

  // 2. Detección por navegador (Accept-Language: "es-CO,es;q=0.9,en;q=0.8")
  try {
    const h = await headers();
    const accept = h.get("accept-language") || "";
    for (const part of accept.split(",")) {
      const code = part.split(";")[0].trim().toLowerCase().slice(0, 2);
      if (SUPPORTED_LOCALES.includes(code)) return code;
    }
  } catch {}

  return DEFAULT_LOCALE;
}

export function getMessages(locale) {
  return MESSAGES[locale] ?? MESSAGES[DEFAULT_LOCALE];
}

/** t() para server components: `const t = await getT("hero");` */
export async function getT(namespace) {
  const locale = await getLocale();
  return makeT(getMessages(locale), namespace, MESSAGES[DEFAULT_LOCALE]);
}
