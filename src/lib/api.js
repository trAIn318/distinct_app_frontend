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

// ── Panel de administración de compañía e invitaciones ──────────────────────
//
// Dos grupos: los endpoints PÚBLICOS de la invitación (sin sesión, porque la
// persona todavía no tiene cuenta usable) y los del panel (con Bearer).
//
// Todos adjuntan al Error el `status` y, cuando el backend la usa, la forma
// `errors`. El patrón heredado del repo lanzaba `new Error(detail)` y perdía el
// estado, así que `companyAdmin.errorMessageFor` solo podía traducir por texto;
// con el estado traduce también los 401/403/404/422/5xx, y con `errors` puede
// mostrar el motivo real de un archivo rechazado en vez del genérico.

/** Lee el cuerpo como JSON, o devuelve {} si no es JSON. */
async function _cuerpo(res) {
  try {
    return (await res.json()) ?? {};
  } catch {
    return {};
  }
}

/** Convierte una respuesta no-ok en un Error con todo lo que el backend dio.
 *
 * El mensaje NO lleva prosa inventada en inglés. `companyAdmin.errorMessageFor`
 * usa el texto crudo del error como penúltimo recurso, así que una frase en
 * inglés puesta aquí se pintaba LITERALMENTE en una interfaz en español cada
 * vez que el backend no mandaba `detail` (un 500 de Django, por ejemplo). El
 * texto que lee la persona lo decide esa función, con sus claves i18n; aquí
 * solo viaja lo que el backend dijo, más el estado para que pueda traducirlo.
 *
 * `respaldo` queda como mensaje de diagnóstico para la consola cuando no hay
 * nada del backend, nunca como texto de pantalla: va a `devMessage`.
 */
function _errorDe(res, data, respaldo) {
  const err = new Error(data.detail || "");
  err.status = res.status;
  err.devMessage = respaldo || `HTTP ${res.status}`;

  if (data.errors !== undefined) {
    err.errors = data.errors;
    return err;
  }
  // CUARTA forma de error del backend: los errores de campo de DRF al TOPE del
  // cuerpo, sin envolver. Es lo que devuelve `invitation_accept_view` en su 400
  // (`Response(ser.errors, 400)`), por ejemplo cuando la contraseña no llega a
  // los 8 caracteres que exige el serializador. Sin leerla, la persona invitada
  // veía un mensaje que no decía nada en la única pantalla que debe pasar para
  // existir en el sistema.
  const campos = Object.entries(data).filter(
    ([, v]) => typeof v === "string"
      || (Array.isArray(v) && v.some((x) => typeof x === "string")),
  );
  if (campos.length) err.errors = Object.fromEntries(campos);
  return err;
}

function _bearer() {
  const token = getAccessToken();
  if (!token) throw new Error("You must be signed in.");
  return token;
}

/** Petición autenticada con cuerpo JSON (o sin cuerpo). */
async function _apiAuth(path, { method = "GET", body, respaldo } = {}) {
  const token = _bearer();
  const headers = { Authorization: `Bearer ${token}` };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${API_URL}/api${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
  });
  const data = await _cuerpo(res);
  if (!res.ok) throw _errorDe(res, data, respaldo);
  return data;
}

/** Petición autenticada que sube un archivo.
 *  NO fija Content-Type: el navegador tiene que poner el boundary del
 *  multipart, y fijarlo a mano produce una petición que el backend no parsea. */
async function _apiUpload(path, file, respaldo) {
  const token = _bearer();
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(`${API_URL}/api${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body,
    cache: "no-store",
  });
  const data = await _cuerpo(res);
  if (!res.ok) throw _errorDe(res, data, respaldo);
  return data;
}

// ── Invitación: público, sin sesión ────────────────────────────────────────

/**
 * GET /api/invitations/<token>/
 * De qué empresa es la invitación y de qué tipo. NO devuelve el correo: el
 * backend lo omite a propósito para no confirmar que una dirección fue invitada.
 */
export async function getInvitationInfo(token) {
  // fetchResilient, no `fetch` pelado: esta es la PRIMERA peticion que hace una
  // persona nueva, y en Render free el servicio tarda ~30-60 s en despertar. El
  // login ya usa este helper por el mismo motivo; aqui hacia mas falta todavia,
  // porque un fallo se le presentaba como "tu enlace esta muerto".
  const res = await fetchResilient(`${API_URL}/api/invitations/${encodeURIComponent(token)}/`, {
    cache: "no-store",
  });
  const data = await _cuerpo(res);
  if (!res.ok) throw _errorDe(res, data, "This invitation link is not valid.");
  return data;
}

/**
 * POST /api/invitations/<token>/accept/
 * Activa la cuenta y devuelve la sesión (igual que el login).
 * Para una cuenta nueva el backend EXIGE `accept_policy`; para una cuenta que ya
 * existe ignora el cuerpo, así que se manda vacío.
 */
export async function acceptInvitation(token, { password, confirmPassword, acceptPolicy } = {}) {
  const body = {};
  if (password !== undefined) {
    body.password = password;
    body.confirm_password = confirmPassword;
    body.accept_policy = Boolean(acceptPolicy);
  }
  const res = await fetch(`${API_URL}/api/invitations/${encodeURIComponent(token)}/accept/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = await _cuerpo(res);
  if (!res.ok) throw _errorDe(res, data, "Could not activate your account.");
  return data;
}

// ── Panel: requiere sesión ─────────────────────────────────────────────────

/** GET /api/company-admin/members/ → {members, invitations, total} */
export async function getCompanyMembers({ q, limit, offset } = {}) {
  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
  if (limit !== undefined && limit !== null) qs.set("limit", String(limit));
  if (offset !== undefined && offset !== null) qs.set("offset", String(offset));
  const cola = qs.toString();
  return _apiAuth(`/company-admin/members/${cola ? `?${cola}` : ""}`, {
    respaldo: "Could not load your staff.",
  });
}

/** POST /api/company-admin/members/ → {invitation, email_sent} */
export async function addCompanyMember(email) {
  return _apiAuth("/company-admin/members/", {
    method: "POST", body: { email }, respaldo: "Could not send the invitation.",
  });
}

/**
 * PATCH /api/company-admin/members/<id>/
 *
 * OJO con los nombres: el backend **lee** con `firstname`/`lastname`/`phone` y
 * **escribe** con `usr_firstname`/`usr_lastname`/`usr_phone`/`lang_code` (su
 * lista blanca `EDITABLE_FIELDS`). O sea que los nombres NO coinciden en tres
 * de los cuatro campos. Pasar los de lectura hace que el backend no encuentre
 * ningun campo editable y responda un 400 con texto interno
 * ("no hay campos editables en la solicitud"), que acabaria en pantalla.
 *
 * @param {Object} fields - solo `usr_firstname`, `usr_lastname`, `usr_phone`,
 *   `lang_code`.
 */
export async function updateCompanyMember(id, fields) {
  return _apiAuth(`/company-admin/members/${id}/`, {
    method: "PATCH", body: fields, respaldo: "Could not save the changes.",
  });
}

/** POST /api/company-admin/members/<id>/deactivate/ */
export async function deactivateCompanyMember(id) {
  return _apiAuth(`/company-admin/members/${id}/deactivate/`, {
    method: "POST", respaldo: "Could not deactivate this person.",
  });
}

/** POST /api/company-admin/members/<id>/unlink/ */
export async function unlinkCompanyMember(id) {
  return _apiAuth(`/company-admin/members/${id}/unlink/`, {
    method: "POST", respaldo: "Could not remove this person from your team.",
  });
}

/** POST /api/company-admin/invitations/<id>/resend/ → {invitation, email_sent} */
export async function resendInvitation(id) {
  return _apiAuth(`/company-admin/invitations/${id}/resend/`, {
    method: "POST", respaldo: "Could not resend the invitation.",
  });
}

/** DELETE /api/company-admin/invitations/<id>/ */
export async function cancelInvitation(id) {
  return _apiAuth(`/company-admin/invitations/${id}/`, {
    method: "DELETE", respaldo: "Could not cancel the invitation.",
  });
}

// ── Carga por archivo ──────────────────────────────────────────────────────

/** GET /api/company-admin/import/template/ → el CSV como TEXTO, no JSON. */
export async function getImportTemplate() {
  const token = _bearer();
  const res = await fetch(`${API_URL}/api/company-admin/import/template/`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw _errorDe(res, await _cuerpo(res), "Could not download the template.");
  return res.text();
}

/** POST /api/company-admin/import/preview/ → qué pasaría, sin escribir nada. */
export async function previewMembersImport(file) {
  return _apiUpload("/company-admin/import/preview/", file, "Could not read the file.");
}

/** POST /api/company-admin/import/ → emite las invitaciones. */
export async function commitMembersImport(file) {
  return _apiUpload("/company-admin/import/", file, "Could not import the file.");
}
