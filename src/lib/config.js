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

// ── Sitio público ──────────────────────────────────────────────────────────

// Dominio canónico. Lo usan las etiquetas canónicas, Open Graph, el sitemap y
// los datos estructurados JSON-LD, que EXIGEN URLs absolutas: una ruta
// relativa ahí se ignora en silencio y el resultado enriquecido no aparece.
// Sin barra final — las rutas se concatenan empezando por "/".
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://distincthospitalitysolutions.com"
).replace(/\/+$/, "");

// ── Agendar una reunión (calendario de HubSpot) ────────────────────────────

// Única fuente de la dirección del calendario. La usan el formulario de
// contacto y el centro de white papers; donde no esté definida, el canal
// simplemente no se ofrece.
//
// Va VACÍA por omisión, a diferencia del resto de este archivo. Aquí sí es lo
// correcto: el valor que estuvo fijo en el código hasta ahora era
// `meet.hubspot.com/veronica-straw`, un dominio que NO EXISTE en el DNS
// (verificado contra el DNS local y contra 8.8.8.8). Quien le daba clic no
// recibía nada. Un valor por omisión equivocado es peor que ninguno: con éste
// el enlace desaparece hasta que haya uno real.
//
// La cuenta de HubSpot de Distinct vive en la región na2, así que el enlace
// bueno probablemente empiece por `meetings-na2.hubspot.com`. Está pedido.
export const BOOKING_URL = (process.env.NEXT_PUBLIC_BOOKING_URL || "").trim();

// ── Contacto publico ──────────────────────────────────────────

// La direccion que el sitio PUBLICA. Es un dato distinto de `CONTACT_EMAIL` en
// el backend (distinct/settings_api.py): ese decide a quien le ENTREGA el
// formulario, este decide que direccion LEEN las personas y las maquinas. Hoy
// son la misma cuenta y conviene que lo sigan siendo.
//
// Tiene que estar publicada, no solo configurada: un asistente de IA, un
// rastreador o el proceso que reclama el sitio solo pueden citar el correo que
// encuentran en la pagina y en los datos estructurados. Un destino que vive
// unicamente en el backend no existe para nadie de afuera.
export const CONTACT_EMAIL = (
  process.env.NEXT_PUBLIC_CONTACT_EMAIL || "distinctassistant@traindistinct.com"
).trim();

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
 *
 * OJO: igual que en el de Outlook, aquí NO se usa URLSearchParams: codifica
 * los espacios como "+" y algunos composers los muestran literales
 * ("Hi+Veronica"). encodeURIComponent usa %20, que se decodifica como
 * espacio en cualquier query string.
 */
export function buildOwnersGmailCompose(subject, body) {
  const to = OWNER_EMAILS.join(",");
  const parts = ["view=cm", "fs=1", `to=${encodeURIComponent(to)}`];
  if (subject) parts.push(`su=${encodeURIComponent(subject)}`);
  if (body) parts.push(`body=${encodeURIComponent(body)}`);
  return `https://mail.google.com/mail/?${parts.join("&")}`;
}
