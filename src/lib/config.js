/**
 * src/lib/config.js
 * Configuración centralizada — todo lo parametrizable vive aquí.
 * Las vars NEXT_PUBLIC_* están disponibles en server y client components.
 */

// ── Backend ────────────────────────────────────────────────────────────────

// Si NEXT_PUBLIC_API_URL está definida (p.ej. .env.local en desarrollo o una
// variable en Vercel), manda esa. Si no, cae al backend de producción en Render
// — así el despliegue funciona sin tener que configurar la variable en Vercel.
// La URL es pública (no es secreto). En local se usa .env.local con localhost.
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://distinct-app-backend.onrender.com";

// ── Moodle ─────────────────────────────────────────────────────────────────

export const MOODLE_URL =
  process.env.NEXT_PUBLIC_MOODLE_URL ||
  "https://moodle.traindistincthospitality.com";

// ── Cursos ─────────────────────────────────────────────────────────────────

export const HOME_COURSES_COUNT = parseInt(
  process.env.NEXT_PUBLIC_HOME_COURSES_COUNT || "3",
  10
);

export const COURSE_IMAGE_BASE =
  process.env.NEXT_PUBLIC_COURSE_IMAGE_BASE || "/img/courses";

// ── Owners (flujo "Pay" / "I'm interested" via mailto) ────────────────────

const OWNER_EMAILS_CSV =
  process.env.NEXT_PUBLIC_OWNER_EMAILS ||
  "Veronica@distincthospitalitysolutions.com,Luznedy@traindistinct.com,Hugo@traindistinct.com";

export const OWNER_EMAILS = OWNER_EMAILS_CSV.split(",")
  .map((e) => e.trim())
  .filter(Boolean);

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Resuelve la URL de la imagen de un curso a partir del filename almacenado en DB.
 * El backend devuelve "bartender.jpg"; nosotros la servimos desde /public/img/courses.
 */
export function resolveCourseImage(filename) {
  if (!filename) return `${COURSE_IMAGE_BASE}/under_construction.jpg`;
  // Si ya viene una URL completa, no la tocamos
  if (filename.startsWith("http://") || filename.startsWith("https://")) {
    return filename;
  }
  return `${COURSE_IMAGE_BASE}/${filename}`;
}

/**
 * Construye un `mailto:` con los 3 dueños como destinatarios.
 * Depende de que el SO tenga un mail handler — si no, no hace nada visible.
 */
export function buildOwnersMailto(subject, body) {
  const to = OWNER_EMAILS.join(",");
  const parts = [];
  if (subject) parts.push(`subject=${encodeURIComponent(subject)}`);
  if (body) parts.push(`body=${encodeURIComponent(body)}`);
  const qs = parts.join("&");
  return `mailto:${to}${qs ? "?" + qs : ""}`;
}

/**
 * Deeplink al composer web de Outlook con los 3 owners pre-rellenados.
 * Siempre funciona — abre en nueva pestaña sin depender del mail handler del SO.
 * Si el usuario no tiene cuenta Microsoft, Outlook le pedirá login (caso raro).
 */
export function buildOwnersOutlookCompose(subject, body) {
  // OJO: no usar URLSearchParams — codifica espacios como "+" y el composer
  // de Outlook los muestra literales ("Hi+Veronica"). encodeURIComponent
  // usa %20, que Outlook sí decodifica correctamente.
  const to = OWNER_EMAILS.join(",");
  const parts = [`to=${encodeURIComponent(to)}`];
  if (subject) parts.push(`subject=${encodeURIComponent(subject)}`);
  if (body) parts.push(`body=${encodeURIComponent(body)}`);
  return `https://outlook.office.com/mail/deeplink/compose?${parts.join("&")}`;
}

/**
 * Resuelve la URL del logo de un partner. La DB guarda solo el filename
 * (p.ej. "alani.png"); los archivos viven en los estáticos del backend,
 * servidos por whitenoise tanto en local como en Render.
 */
export function resolvePartnerLogo(filename) {
  if (!filename) return null;
  if (filename.startsWith("http://") || filename.startsWith("https://")) {
    return filename;
  }
  return `${API_URL}/static/images/${filename}`;
}

/**
 * Deeplink al composer de Gmail con los 3 owners pre-rellenados.
 * Útil como alternativa universal — abre Gmail en nueva pestaña.
 */
export function buildOwnersGmailCompose(subject, body) {
  const to = OWNER_EMAILS.join(",");
  const params = new URLSearchParams();
  params.set("view", "cm");
  params.set("fs", "1");
  params.set("to", to);
  if (subject) params.set("su", subject);
  if (body) params.set("body", body);
  return `https://mail.google.com/mail/?${params.toString()}`;
}
