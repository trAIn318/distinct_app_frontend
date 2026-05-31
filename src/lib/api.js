/**
 * src/lib/api.js
 * Cliente del backend Django REST. Usa fetch nativo (server-compatible).
 *
 * Patrón de cache:
 *   - Por defecto Next.js cachea fetch() en server components.
 *   - Pasamos { revalidate: 60 } para revalidar cada 60s en builds prod.
 */

import { API_URL } from "./config";

const DEFAULT_REVALIDATE = 60;

async function apiGet(path, { revalidate = DEFAULT_REVALIDATE } = {}) {
  const url = `${API_URL}/api${path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    next: { revalidate },
  });
  if (!res.ok) {
    // No tiramos el render — devolvemos null y dejamos que el caller maneje
    console.error(`[api] GET ${url} → ${res.status}`);
    return null;
  }
  return res.json();
}

// ── Cursos ──────────────────────────────────────────────────────────────────

/**
 * Lista de cursos visibles.
 * @param {Object} opts
 * @param {number} [opts.limit] — máx cursos a devolver (la home pide 3)
 * @returns {Promise<Array>} array de cursos (vacío si falla)
 */
export async function getCourses({ limit } = {}) {
  const qs = limit ? `?limit=${limit}` : "";
  const data = await apiGet(`/courses/${qs}`);
  return data?.courses ?? [];
}

/**
 * Detalle de un curso por id.
 */
export async function getCourse(id) {
  return apiGet(`/courses/${id}/`);
}

// ── Auth ──────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/login/
 * Acepta email O username en `usr_name`.
 * Devuelve { access, refresh, user }
 */
export async function loginApi(identifier, password) {
  const res = await fetch(`${API_URL}/api/auth/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usr_name: identifier, usr_password: password }),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data.detail || "Invalid credentials.";
    throw new Error(message);
  }
  return data;
}

/**
 * POST /api/auth/register/
 * Crea usuario en nuestra DB + Moodle (best-effort) + registra policy_agreement.
 */
export async function registerApi(payload) {
  const res = await fetch(`${API_URL}/api/auth/register/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // El backend devuelve { detail } o { field: [errors] }
    if (data.detail) throw new Error(data.detail);
    const firstField = Object.keys(data)[0];
    if (firstField) {
      const value = data[firstField];
      throw new Error(Array.isArray(value) ? value[0] : String(value));
    }
    throw new Error("Registration failed.");
  }
  return data;
}

/**
 * GET /api/policies/active/
 * Devuelve la política de tratamiento de datos vigente.
 */
export async function getActivePolicy() {
  return apiGet(`/policies/active/`, { revalidate: 300 });
}

// ── Reviews / Partners / FAQ (preparado para futuras secciones) ────────────

export async function getReviews() {
  const data = await apiGet(`/reviews/`);
  return data?.reviews ?? [];
}

export async function getPartners() {
  const data = await apiGet(`/partners/`);
  return data?.partners ?? [];
}

export async function getFaq() {
  const data = await apiGet(`/chatbot/faq/`);
  return data?.faqs ?? [];
}
