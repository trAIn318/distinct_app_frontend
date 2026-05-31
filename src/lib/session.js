/**
 * src/lib/session.js
 * Manejo de tokens JWT en cookies del navegador.
 *
 * Notas de seguridad:
 *   - Usamos document.cookie (no es httpOnly — el JS puede leerlo).
 *     httpOnly real requeriría que Next.js setee la cookie desde un Route
 *     Handler/Server Action; lo dejamos como mejora de Fase 4 (hardening).
 *   - Por ahora cookies con Secure (en producción) + SameSite=Lax.
 *
 * Las cookies se llaman `dx_access` y `dx_user` para que el middleware
 * (src/middleware.ts si existe) pueda protegerlas en rutas privadas.
 */

const ACCESS_KEY = "dx_access";
const REFRESH_KEY = "dx_refresh";
const USER_KEY = "dx_user";

function isBrowser() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function isSecure() {
  return isBrowser() && window.location.protocol === "https:";
}

function setCookie(name, value, maxAgeSeconds) {
  if (!isBrowser()) return;
  const attrs = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    `Max-Age=${maxAgeSeconds}`,
    "SameSite=Lax",
  ];
  if (isSecure()) attrs.push("Secure");
  document.cookie = attrs.join("; ");
}

function deleteCookie(name) {
  if (!isBrowser()) return;
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
}

function readCookie(name) {
  if (!isBrowser()) return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

// ── Public API ─────────────────────────────────────────────────────────────

const ACCESS_TTL = 60 * 60;            // 1 h
const REFRESH_TTL = 60 * 60 * 24 * 7;  // 7 d

export function saveSession({ access, refresh, user }) {
  if (access) setCookie(ACCESS_KEY, access, ACCESS_TTL);
  if (refresh) setCookie(REFRESH_KEY, refresh, REFRESH_TTL);
  if (user) setCookie(USER_KEY, JSON.stringify(user), REFRESH_TTL);
}

export function clearSession() {
  deleteCookie(ACCESS_KEY);
  deleteCookie(REFRESH_KEY);
  deleteCookie(USER_KEY);
}

export function getAccessToken() {
  return readCookie(ACCESS_KEY);
}

export function getCurrentUser() {
  const raw = readCookie(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function isAuthenticated() {
  return Boolean(getAccessToken());
}
