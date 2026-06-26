/**
 * src/lib/api.js
 * Cliente del backend Django REST. Usa fetch nativo (server-compatible).
 *
 * Patrón de cache:
 *   - Por defecto Next.js cachea fetch() en server components.
 *   - Pasamos { revalidate: 60 } para revalidar cada 60s en builds prod.
 */

import { API_URL } from "./config";
import { getAccessToken } from "./session";

const DEFAULT_REVALIDATE = 60;

async function apiGet(path, { revalidate = DEFAULT_REVALIDATE } = {}) {
  const url = `${API_URL}/api${path}`;
  try {
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
  } catch (err) {
    // Backend inaccesible (apagado, dormido en Render, o durante `next build`
    // sin API disponible). Sin este catch, el prerender de páginas que
    // fetchean (p.ej. /courses) tumba el build completo con ECONNREFUSED.
    // Devolvemos null: las secciones se ocultan y el ISR (revalidate 60s)
    // recupera los datos reales en cuanto el backend responda.
    console.error(`[api] GET ${url} → fetch failed: ${err?.message || err}`);
    return null;
  }
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
 * POST /api/auth/verify-register-otp/
 * Paso 2 del registro: valida el código de activación enviado al email y, si es
 * correcto, activa la cuenta y devuelve { access, refresh, user }.
 */
export async function verifyRegisterOtpApi(email, otp) {
  const res = await fetch(`${API_URL}/api/auth/verify-register-otp/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, otp }),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (data.detail) throw new Error(data.detail);
    const firstField = Object.keys(data)[0];
    if (firstField) {
      const value = data[firstField];
      throw new Error(Array.isArray(value) ? value[0] : String(value));
    }
    throw new Error("Could not verify your code.");
  }
  return data;
}

/**
 * POST /api/auth/forgot-password/
 * Paso 1 del flujo OTP: solicita el envío de un código de 6 dígitos al email.
 * El backend SIEMPRE responde 200 con el mismo mensaje (no revela si la cuenta
 * existe) para evitar enumeración de cuentas. Devuelve { detail }.
 */
export async function requestPasswordResetApi(email) {
  const res = await fetch(`${API_URL}/api/auth/forgot-password/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || "Could not start password reset.");
  }
  return data;
}

/**
 * POST /api/auth/reset-password/
 * Paso 2 del flujo OTP: valida el código y fija la nueva contraseña.
 * Mismo mensaje de error para OTP inválido/expirado. Devuelve { detail }.
 */
export async function resetPasswordApi({ email, otp, newPassword, confirmPassword }) {
  const res = await fetch(`${API_URL}/api/auth/reset-password/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      otp,
      new_password: newPassword,
      confirm_password: confirmPassword,
    }),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (data.detail) throw new Error(data.detail);
    const firstField = Object.keys(data)[0];
    if (firstField) {
      const value = data[firstField];
      throw new Error(Array.isArray(value) ? value[0] : String(value));
    }
    throw new Error("Could not reset password.");
  }
  return data;
}

// ── Derechos del titular (autenticado) ─────────────────────────────────────

/**
 * GET /api/user/data-export/
 * Portabilidad: devuelve todos los datos personales del usuario en JSON.
 */
export async function exportMyDataApi() {
  const token = getAccessToken();
  if (!token) throw new Error("You must be signed in.");
  const res = await fetch(`${API_URL}/api/user/data-export/`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "Could not export your data.");
  return data;
}

/**
 * DELETE /api/user/account/
 * Supresión: anonimiza la cuenta. Requiere reconfirmar la contraseña.
 */
export async function deleteAccountApi(password) {
  const token = getAccessToken();
  if (!token) throw new Error("You must be signed in.");
  const res = await fetch(`${API_URL}/api/user/account/`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password }),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "Could not delete your account.");
  return data;
}

/**
 * GET /api/policies/active/
 * Devuelve la política de tratamiento de datos vigente.
 */
export async function getActivePolicy() {
  return apiGet(`/policies/active/`, { revalidate: 300 });
}

/**
 * GET /api/policies/form/<name>/
 * Devuelve la finalidad de tratamiento de un formulario (ej. 'cookie').
 */
export async function getFormPolicy(formName) {
  return apiGet(`/policies/form/${formName}/`, { revalidate: 300 });
}

// ── Reviews / Partners / FAQ (preparado para futuras secciones) ────────────

/**
 * GET /api/reviews/?limit=N
 * Lista de testimonios aprobados.
 */
export async function getReviews({ limit } = {}) {
  const qs = limit ? `?limit=${limit}` : "";
  const data = await apiGet(`/reviews/${qs}`);
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

// ── Dashboard / Menú (autenticado) ─────────────────────────────────────────

/** GET /api/menu/ — opciones de menú del rol del usuario. [] si falla. */
export async function getMenu() {
  const token = getAccessToken();
  if (!token) return [];
  try {
    const res = await fetch(`${API_URL}/api/menu/`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data?.menu ?? [];
  } catch {
    return [];
  }
}

/** GET /api/dashboard/courses/ — cursos + avances. */
export async function getDashboardCourses() {
  const token = getAccessToken();
  if (!token) return { courses: [], moodle_linked: false };
  try {
    const res = await fetch(`${API_URL}/api/dashboard/courses/`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return { courses: [], moodle_linked: false };
    return await res.json();
  } catch {
    return { courses: [], moodle_linked: false };
  }
}

/** GET /api/dashboard/training/ — devuelve la loginurl SSO de Moodle. */
export async function startTraining() {
  const token = getAccessToken();
  if (!token) throw new Error("You must be signed in.");
  const res = await fetch(`${API_URL}/api/dashboard/training/`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "Training is unavailable right now.");
  return data.loginurl;
}
