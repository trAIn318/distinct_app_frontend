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
 * Despierta el backend. Render (plan free) duerme el servicio tras ~15 min de
 * inactividad; el primer acceso tarda ~30-60s en arrancar y, durante ese
 * arranque, el preflight CORS se pierde (error "No Access-Control-Allow-Origin"
 * + ERR_FAILED). Llamando esto al abrir el login, el server despierta MIENTRAS
 * el usuario escribe, de modo que el POST ya lo encuentre listo.
 * Fire-and-forget: nunca lanza ni bloquea.
 */
export function warmBackend() {
  try {
    fetch(`${API_URL}/api/health/`, { method: "GET", cache: "no-store" }).catch(() => {});
  } catch {}
}

/**
 * Ejecuta un fetch reintentando SOLO ante fallos de red (fetch rechaza con
 * TypeError: server dormido en Render o preflight perdido durante el arranque
 * en frío). NO reintenta respuestas HTTP (4xx/5xx ya llegaron al backend).
 * Seguro para POST: un preflight fallido significa que la petición nunca se
 * ejecutó en el servidor, así que reintentarla no duplica efectos.
 */
async function fetchResilient(url, options, { retries = 3, baseDelayMs = 2000 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetch(url, options);
    } catch (err) {
      lastErr = err;
      if (attempt === retries) break;
      await new Promise((r) => setTimeout(r, baseDelayMs * (attempt + 1)));
    }
  }
  throw lastErr;
}

/**
 * POST /api/auth/login/
 * Acepta email O username en `usr_name`.
 * Devuelve { access, refresh, user }
 */
export async function loginApi(identifier, password) {
  let res;
  try {
    res = await fetchResilient(`${API_URL}/api/auth/login/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usr_name: identifier, usr_password: password }),
      cache: "no-store",
    });
  } catch {
    throw new Error("We couldn't reach the server — it may be waking up. Please try again in a moment.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data.detail || "Invalid credentials.";
    throw new Error(message);
  }
  return data;
}

/**
 * POST /api/auth/verify-login-otp/
 * Segundo paso del login cuando la cuenta requiere OTP por inactividad.
 * Acepta el mismo identificador (email o username) usado en el login.
 * Devuelve { access, refresh, user }.
 */
export async function verifyLoginOtpApi(identifier, otp) {
  let res;
  try {
    res = await fetchResilient(`${API_URL}/api/auth/verify-login-otp/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usr_name: identifier, otp }),
      cache: "no-store",
    });
  } catch {
    throw new Error("We couldn't reach the server — it may be waking up. Please try again in a moment.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || "Invalid or expired code.");
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

/**
 * Añade `wantsurl` a un loginurl SSO de Moodle (auth_userkey). Su login.php
 * redirige a esa URL tras iniciar sesión, así el usuario cae ya logueado en un
 * curso concreto (mismo Moodle → URL local permitida). Sin destino, devuelve el
 * loginurl tal cual (aterriza en el dashboard de Moodle).
 * @param {string} loginurl
 * @param {string} [targetUrl]
 * @returns {string}
 */
export function appendWantsurl(loginurl, targetUrl) {
  if (!loginurl || !targetUrl) return loginurl;
  const sep = loginurl.includes("?") ? "&" : "?";
  return `${loginurl}${sep}wantsurl=${encodeURIComponent(targetUrl)}`;
}

/**
 * GET /api/dashboard/training/ — devuelve la loginurl SSO de Moodle.
 * @param {string} [targetUrl] si se pasa, el SSO redirige a esa URL tras loguear
 *   (p.ej. un curso). Si no, aterriza en el dashboard de Moodle (botón Entrenar).
 */
export async function startTraining(targetUrl) {
  const token = getAccessToken();
  if (!token) throw new Error("You must be signed in.");
  const res = await fetch(`${API_URL}/api/dashboard/training/`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "Training is unavailable right now.");
  return appendWantsurl(data.loginurl, targetUrl);
}

// ── Evaluaciones (autenticado) ──────────────────────────────────────────────

/**
 * Fetch autenticado con el mismo patrón usado por `exportMyDataApi` /
 * `deleteAccountApi` / `startTraining`: bearer token de session.js, JSON body,
 * sin caché, y error con el `detail` del backend si la respuesta no es ok.
 * Se extrae aquí porque el módulo de evaluaciones tiene 7 endpoints que
 * comparten exactamente ese comportamiento.
 */
async function authFetch(path, { method = "GET", body } = {}) {
  const token = getAccessToken();
  if (!token) throw new Error("You must be signed in.");
  const res = await fetch(`${API_URL}/api${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      data.detail ||
        (Array.isArray(data.errors) && data.errors[0]) ||
        "Something went wrong. Please try again."
    );
  }
  return data;
}

/** GET /api/eval/categories/ — categorías de evaluación disponibles. */
export async function getEvalCategories() {
  return authFetch("/eval/categories/");
}

/** GET /api/eval/courses/?category_id=<id> — cursos evaluables de una categoría. */
export async function getEvalCourses(categoryId) {
  return authFetch(`/eval/courses/?category_id=${categoryId}`);
}

/** GET /api/eval/status/?course_id=<id> — estado de la evaluación del usuario para el curso. */
export async function getEvalStatus(courseId) {
  return authFetch(`/eval/status/?course_id=${courseId}`);
}

/** POST /api/eval/begin/ — inicia (o retoma) un intento de evaluación. */
export async function beginEval(courseId) {
  return authFetch("/eval/begin/", {
    method: "POST",
    body: { course_id: courseId },
  });
}

/**
 * POST /api/eval/grade/ — envía respuestas para calificar.
 * @param {number|string} courseId
 * @param {Object} answers — { questionId: [answerId, ...] }
 */
export async function gradeEval(courseId, answers) {
  return authFetch("/eval/grade/", {
    method: "POST",
    body: { course_id: courseId, answers },
  });
}

/**
 * POST /api/eval/save/ — persiste/confirma el intento de evaluación ya
 * calificado (llamado desde el botón "Guardar" del wizard, después de
 * `gradeEval`). El backend vuelve a calificar las respuestas server-side
 * antes de guardarlas — no es un guardado de progreso parcial sin calificar.
 * @param {number|string} courseId
 * @param {Object} answers — { questionId: [answerId, ...] }
 */
export async function saveEval(courseId, answers) {
  return authFetch("/eval/save/", {
    method: "POST",
    body: { course_id: courseId, answers },
  });
}

/** GET /api/eval/history/ — historial de evaluaciones del usuario. */
export async function getEvalHistory() {
  return authFetch("/eval/history/");
}

// ── Analytics: propiedades + carga de ventas (autenticado) ──────────────────

/** POST multipart autenticado. No fija Content-Type: el navegador pone el
 *  boundary de multipart/form-data automáticamente. */
export async function authUpload(path, formData) {
  const token = getAccessToken();
  if (!token) throw new Error("You must be signed in.");
  const res = await fetch(`${API_URL}/api${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      data.detail ||
        (Array.isArray(data.errors) && data.errors[0]) ||
        "Upload failed. Please try again."
    );
  }
  return data;
}

/** GET /api/analytics/properties/ — propiedades del alcance. [] si falla suave. */
export async function getProperties() {
  const data = await authFetch("/analytics/properties/");
  return data?.properties ?? [];
}

/** POST /api/analytics/properties/ — crea una propiedad. */
export async function createProperty({ name, currency, comp_id }) {
  return authFetch("/analytics/properties/", {
    method: "POST",
    body: { name, currency, ...(comp_id != null ? { comp_id } : {}) },
  });
}

/** PATCH /api/analytics/properties/<id>/ — renombra / cambia moneda / activa. */
export async function updateProperty(id, changes) {
  return authFetch(`/analytics/properties/${id}/`, { method: "PATCH", body: changes });
}

/** POST /api/analytics/uploads/preview/ — dry-run (no escribe). */
export async function previewUpload(propertyId, file) {
  const fd = new FormData();
  fd.append("property_id", propertyId);
  fd.append("file", file);
  return authUpload("/analytics/uploads/preview/", fd);
}

/** POST /api/analytics/uploads/ — confirma y guarda. */
export async function commitUpload(propertyId, file) {
  const fd = new FormData();
  fd.append("property_id", propertyId);
  fd.append("file", file);
  return authUpload("/analytics/uploads/", fd);
}

/** GET /api/analytics/reports/sales/ — reporte agregado del panel. */
export async function getSalesReport({ start, end, propertyId } = {}) {
  const qs = new URLSearchParams();
  if (start) qs.set("start", start);
  if (end) qs.set("end", end);
  if (propertyId && propertyId !== "all") qs.set("property_id", propertyId);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return authFetch(`/analytics/reports/sales/${suffix}`);
}
