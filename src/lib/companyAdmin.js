/**
 * src/lib/companyAdmin.js
 * Lógica pura del panel Admin Company: decide el estado de cada persona, une
 * las dos colecciones del backend en una sola tabla, traduce los errores y
 * valida el archivo de carga.
 *
 * SIN red, SIN React, SIN Next: ni un import. Eso es lo que la hace probable al
 * 100% y lo que deja a las pantallas con solo la parte visual encima.
 *
 * Forma de los datos que consume (de `api/company_admin_views.py`):
 *   miembro:    {id, name, email, firstname, lastname, phone, lang_code,
 *                rol_id, active, confirmed, last_login}
 *   invitación: {id, email, kind, status, expires_at, expired}
 */

// ── Estados de una fila ────────────────────────────────────────────────────
//
// Los valores son también el fragmento de clave i18n de cada estado, así las
// pantallas escriben t(`status.${row.status}`) sin una segunda tabla.
export const ROW_STATUS = Object.freeze({
  ACTIVE: "active",
  NEVER_ENTERED: "neverEntered",
  INVITED: "invited",
  EXPIRED: "expired",
  DEACTIVATED: "deactivated",
});

/** Topes de la carga por archivo, los mismos que impone el backend. */
export const IMPORT_LIMITS = Object.freeze({
  maxBytes: 1024 * 1024,  // 1 MB  (svc.MAX_IMPORT_BYTES)
  maxRows: 50,            // filas (svc.MAX_IMPORT_ROWS)
});

/** Rol del personal de una empresa cliente. Los demás son pares administradores. */
const ROL_STAFF = 3;

function texto(valor) {
  return typeof valor === "string" ? valor.trim() : "";
}

/**
 * Estado de un miembro.
 *
 * Decide SOLO por `active` y `last_login`. **Nunca mira `confirmed`**: medido
 * contra la base real, de 159 usuarios solo 13 lo tienen y los 50 que
 * pertenecen a una empresa están todos sin confirmar, activos y usando el
 * sistema. Ese campo ya causó dos defectos en producción en este proyecto; el
 * backend lo devuelve solo por compatibilidad.
 */
export function memberStatus(member) {
  const m = member || {};
  if (!m.active) return ROW_STATUS.DEACTIVATED;
  return texto(m.last_login) ? ROW_STATUS.ACTIVE : ROW_STATUS.NEVER_ENTERED;
}

/**
 * Cómo se llama una persona en la tabla.
 *
 * Los 50 usuarios heredados pueden tener nombre y apellido vacíos o nulos, así
 * que el correo es el identificador de respaldo: la fila nunca queda en blanco.
 */
export function displayNameFor(persona) {
  const p = persona || {};
  const nombre = [texto(p.firstname), texto(p.lastname)].filter(Boolean).join(" ");
  return nombre || texto(p.email);
}

function claveDeOrden(fila) {
  return `${fila.displayName.toLowerCase()}\u0000${fila.email.toLowerCase()}`;
}

/**
 * Una sola lista: "su gente". Une `members` e `invitations` en filas
 * `{key, kind, id, email, displayName, status, canAct}`, ordenadas por nombre
 * mostrado y luego por correo.
 *
 * - `canAct` es falso para los pares administradores (`rol_id` distinto de 3):
 *   el backend rechaza toda escritura sobre ellos, así que su fila va sin
 *   botones de acción.
 * - Una invitación no trae nombre —el backend no lo devuelve— y se identifica
 *   por su correo.
 * - Cada persona aparece exactamente una vez: si el mismo correo llega por las
 *   dos colecciones, gana la fila de miembro.
 */
export function buildRoster(payload) {
  const datos = payload || {};
  const members = Array.isArray(datos.members) ? datos.members : [];
  const invitations = Array.isArray(datos.invitations) ? datos.invitations : [];

  const filas = [];
  const vistos = new Set();

  function agregar(fila) {
    const marca = fila.email.toLowerCase();
    if (marca) {
      if (vistos.has(marca)) return;
      vistos.add(marca);
    }
    filas.push(fila);
  }

  for (const m of members) {
    if (!m) continue;
    const email = texto(m.email);
    const displayName = displayNameFor(m);
    if (!email && !displayName) continue;
    agregar({
      key: `member:${m.id}`,
      kind: "member",
      id: m.id,
      email,
      displayName,
      status: memberStatus(m),
      canAct: m.rol_id === ROL_STAFF,
    });
  }

  for (const inv of invitations) {
    if (!inv) continue;
    const email = texto(inv.email);
    if (!email) continue;
    agregar({
      key: `invitation:${inv.id}`,
      kind: "invitation",
      id: inv.id,
      email,
      displayName: email,
      status: inv.expired ? ROW_STATUS.EXPIRED : ROW_STATUS.INVITED,
      canAct: true,
    });
  }

  return filas.sort((a, b) => claveDeOrden(a).localeCompare(claveDeOrden(b)));
}

// ── Traducción de errores ──────────────────────────────────────────────────
//
// Los mensajes del backend están escritos en español dentro del código y esta
// pantalla es la primera impresión de un cliente que puede estar en inglés, así
// que los casos conocidos se mapean a claves i18n propias. El texto del backend
// queda solo como último recurso.

const ERROR_KEY_PREFIX = "errors.";

/** Códigos reconocidos. El valor es el sufijo de la clave i18n. */
const ERROR_CODES = Object.freeze({
  already: "already",
  rejected: "rejected",
  invalidEmail: "invalidEmail",
  noCompany: "noCompany",
  notFound: "notFound",
  forbidden: "forbidden",
  alreadyInCompany: "alreadyInCompany",
  needsReview: "needsReview",
  unavailable: "unavailable",
  network: "network",
  signedOut: "signedOut",
  generic: "generic",
});

/** Estado HTTP → código, cuando el estado por sí solo ya identifica el caso. */
const POR_ESTADO = Object.freeze({
  401: ERROR_CODES.signedOut,
  403: ERROR_CODES.forbidden,
  404: ERROR_CODES.notFound,
  503: ERROR_CODES.unavailable,
});

/**
 * Firmas de texto, en orden de evaluación. Se comparan sin acentos ni
 * mayúsculas contra el `detail` del backend, que es lo único que llega cuando
 * `api.js` lanza `new Error(data.detail)`.
 */
const POR_TEXTO = [
  ["ya es miembro", ERROR_CODES.already],
  ["invitacion vigente", ERROR_CODES.already],
  ["no se puede incorporar", ERROR_CODES.rejected],
  ["correo invalido", ERROR_CODES.invalidEmail],
  ["sin compania asignada", ERROR_CODES.noCompany],
  ["requiere revision manual", ERROR_CODES.needsReview],
  ["already belongs to a company", ERROR_CODES.alreadyInCompany],
  ["not found or no longer valid", ERROR_CODES.notFound],
  ["temporarily unable", ERROR_CODES.unavailable],
  ["must be signed in", ERROR_CODES.signedOut],
  ["failed to fetch", ERROR_CODES.network],
  ["network request failed", ERROR_CODES.network],
  ["load failed", ERROR_CODES.network],
];

function normalizar(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function codigoDe(error) {
  const e = error || {};
  if (e.code && Object.hasOwn(ERROR_CODES, e.code)) return ERROR_CODES[e.code];
  const mensaje = normalizar(e.message || e.detail);
  for (const [firma, codigo] of POR_TEXTO) {
    if (mensaje.includes(firma)) return codigo;
  }
  if (Object.hasOwn(POR_ESTADO, e.status)) return POR_ESTADO[e.status];
  return null;
}

/**
 * Texto que ve la persona para un error. `t` es el `useT("companyAdmin")` de la
 * pantalla.
 *
 * Orden: código reconocido → firma de texto conocida → estado HTTP → el texto
 * crudo del backend → un mensaje genérico. Nunca devuelve cadena vacía: un
 * fallo silencioso está prohibido.
 */
export function errorMessageFor(error, t) {
  const tr = typeof t === "function" ? t : (clave) => clave;
  const codigo = codigoDe(error);
  if (codigo) return tr(`${ERROR_KEY_PREFIX}${codigo}`);
  const crudo = texto(error && (error.message || error.detail));
  return crudo || tr(`${ERROR_KEY_PREFIX}${ERROR_CODES.generic}`);
}

// ── Carga por archivo ──────────────────────────────────────────────────────

const CATEGORY_KEY_PREFIX = "import.category.";

/**
 * Las cinco categorías de la previsualización, en palabras del jefe y no del
 * código. `error` es la sexta y solo puede salir al confirmar: una fila válida
 * cuya escritura falló.
 */
const CATEGORIES = Object.freeze({
  invite: "invite",      // se va a invitar
  join: "join",          // se va a invitar a unirse (cuenta existente sin empresa)
  already: "already",    // ya es miembro
  rejected: "rejected",  // no se puede incorporar
  invalid: "invalid",    // fila inválida (correo mal escrito o repetido)
  error: "error",        // solo al confirmar
});

/** Clave i18n de la categoría de una fila. Nunca devuelve undefined. */
export function previewCategoryKey(result) {
  const nombre = Object.hasOwn(CATEGORIES, result) ? CATEGORIES[result] : "unknown";
  return `${CATEGORY_KEY_PREFIX}${nombre}`;
}

const REJECTION_KEY_PREFIX = "import.reject.";

/**
 * `null` si el archivo sirve, o la clave i18n del problema. Lo que se puede
 * saber antes —extensión y tamaño— se rechaza sin llamar al backend. El tope de
 * 50 filas no se puede saber sin leer el archivo: ese lo informa el backend.
 *
 * Sin archivo elegido devuelve `null`: todavía no hay nada de qué quejarse.
 */
export function fileRejectionKey(file) {
  if (!file) return null;
  if (!/\.csv$/i.test(String(file.name || ""))) return `${REJECTION_KEY_PREFIX}notCsv`;
  if (Number(file.size) > IMPORT_LIMITS.maxBytes) return `${REJECTION_KEY_PREFIX}tooBig`;
  return null;
}
