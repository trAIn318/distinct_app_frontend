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

/**
 * Lo que el PATCH de un miembro acepta: **nombre de la columna → ancho máximo**.
 *
 * LA TRAMPA DE ESTE ENDPOINT: el listado DEVUELVE `firstname`, `lastname`,
 * `phone` y `lang_code`, pero el PATCH EXIGE `usr_firstname`, `usr_lastname`,
 * `usr_phone` y `lang_code` (su lista blanca `EDITABLE_FIELDS`, medida en
 * `company_admin_service.py:931`). Solo **uno de los cuatro** coincide, y el
 * bucle del backend descarta en silencio toda clave que no esté en su lista:
 * mandar los nombres de lectura no da error, **guarda sin guardar nada**, o
 * responde "no hay campos editables en la solicitud". Por eso el cuerpo se
 * arma en un solo sitio —`buildMemberPatch`— con su prueba.
 */
export const EDIT_LIMITS = Object.freeze({
  usr_firstname: 50,
  usr_lastname: 50,
  usr_phone: 20,
  lang_code: 10,
});

/** Rol del personal de una empresa cliente. Los demás son pares administradores. */
const ROL_STAFF = 3;

/** Prefijo de las claves i18n de la pantalla del panel. */
const PANEL_KEY_PREFIX = "panel.";

const MS_POR_HORA = 60 * 60 * 1000;

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

/**
 * Compara dos filas: primero por nombre mostrado, y solo si empatan, por correo.
 *
 * Son DOS comparaciones separadas a propósito. Antes se concatenaban las dos
 * claves con `\u0000` en medio, y ese carácter es **ignorable en la colación de
 * Unicode**, así que el correo se colaba en la comparación principal: un nombre
 * que fuera prefijo de otro se ordenaba por su correo y caía en un lugar
 * aparentemente aleatorio ("Ana" terminaba después de "Ana Zeta"). Con los 50
 * usuarios heredados sin nombre el nombre mostrado ES el correo, así que los
 * prefijos abundan.
 *
 * El locale va explícito: sin él, `localeCompare` usa el del sistema y dos
 * personas con el mismo panel verían dos órdenes distintos.
 */
const LOCALE_ORDEN = "en";

function comparar(a, b) {
  const porNombre = a.displayName.localeCompare(b.displayName, LOCALE_ORDEN, {
    sensitivity: "base",
  });
  if (porNombre !== 0) return porNombre;
  return a.email.localeCompare(b.email, LOCALE_ORDEN, { sensitivity: "base" });
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
  // Correos de los miembros, para que una invitación no duplique a alguien que
  // ya aparece como miembro. ASIMÉTRICO a propósito: se consulta SOLO en el
  // bucle de invitaciones. Antes se consultaba también entre miembros, y eso
  // BORRABA a una persona real: `usr_email` es único pero sensible a
  // mayúsculas, así que "Juan.Perez@" y "juan.perez@" coexisten en la base y el
  // backend devuelve las dos filas. La segunda desaparecía de la tabla y de las
  // tres acciones de escritura, mientras el contador del backend decía 2. Es el
  // escenario exacto de las cargas masivas heredadas.
  const correosDeMiembros = new Set();

  for (const m of members) {
    if (!m) continue;
    const email = texto(m.email);
    const displayName = displayNameFor(m);
    if (!email && !displayName) continue;
    if (email) correosDeMiembros.add(email.toLowerCase());
    filas.push({
      key: `member:${m.id}`,
      kind: "member",
      id: m.id,
      email,
      displayName,
      name: texto(m.name),   // usr_name: el ?q= del backend lo busca
      // Los cuatro editables, por separado: `displayName` ya viene unido y el
      // formulario de edición necesita nombre y apellido en campos distintos.
      firstname: texto(m.firstname),
      lastname: texto(m.lastname),
      phone: texto(m.phone),
      langCode: texto(m.lang_code),
      status: memberStatus(m),
      canAct: m.rol_id === ROL_STAFF,
    });
  }

  for (const inv of invitations) {
    if (!inv) continue;
    const email = texto(inv.email);
    if (!email) continue;
    if (correosDeMiembros.has(email.toLowerCase())) continue;
    filas.push({
      key: `invitation:${inv.id}`,
      kind: "invitation",
      id: inv.id,
      email,
      displayName: email,
      // La vigencia es de 72 h y el estado es binario, así que sin la fecha el
      // jefe no puede saber si a una invitación le quedan 2 horas o 70.
      expiresAt: texto(inv.expires_at),
      status: inv.expired ? ROW_STATUS.EXPIRED : ROW_STATUS.INVITED,
      canAct: true,
    });
  }

  return filas.sort(comparar);
}

/**
 * Filtra el roster en el navegador por nombre mostrado o por correo.
 *
 * Es la otra mitad de la búsqueda mixta que fija el diseño. El backend filtra
 * con `?q=` **solo a los miembros**: las invitaciones vuelven sin filtrar y,
 * además, sin nombre —el backend no lo devuelve—, así que buscar un nombre
 * nunca podría encontrar a una persona invitada. Este filtro cubre esa mitad.
 *
 * Vive aquí, en la lógica pura, y no dentro del componente, porque dentro solo
 * se podría probar a través del DOM.
 *
 * Compara sin acentos ni mayúsculas, con el mismo normalizador que usan los
 * errores. Sin búsqueda devuelve la lista tal cual (la misma referencia no se
 * garantiza, pero el contenido sí).
 */
export function filterRoster(rows, q) {
  const filas = Array.isArray(rows) ? rows : [];
  const aguja = normalizar(q).trim();
  if (!aguja) return filas.slice();
  return filas.filter((f) => {
    // CUATRO campos, los mismos que el ?q= del backend
    // (usr_name | usr_email | usr_firstname | usr_lastname). Con dos, buscar
    // por el nombre de usuario encontraba a la persona en el servidor y este
    // filtro la escondia: tabla vacia con el contador diciendo 1.
    const campos = [f && f.displayName, f && f.email, f && f.name]
      .map(normalizar)
      .join("");
    return campos.includes(aguja);
  });
}

// ── Traducción de errores ──────────────────────────────────────────────────
//
// Los mensajes del backend están escritos en español dentro del código y esta
// pantalla es la primera impresión de un cliente que puede estar en inglés, así
// que los casos conocidos se mapean a claves i18n propias. El texto del backend
// queda solo como último recurso.

const ERROR_KEY_PREFIX = "errors.";

/**
 * Los topes que la COPIA de los errores de archivo dice en su texto.
 *
 * `errors.fileTooBig` y `errors.fileTooManyRows` nombran el tope, y escribirlo a
 * mano en los dos idiomas dejaba la copia mintiendo en cuanto el tope se moviera
 * —las firmas de `POR_TEXTO` sí lo derivan de `IMPORT_LIMITS`, así que las dos
 * mitades podían separarse en silencio—. Viajan en cada traducción de error:
 * `makeT` solo sustituye los marcadores que la cadena trae, así que para las
 * demás claves es inocuo.
 */
const VARS_TOPES = Object.freeze({
  maxKb: IMPORT_LIMITS.maxBytes / 1024,
  maxRows: IMPORT_LIMITS.maxRows,
});

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
  throttled: "throttled",
  // Los cuatro de la edición de un miembro (MemberEditError). El backend los
  // escribe en español y `errorMessageFor` usa el texto crudo como penúltimo
  // recurso, así que sin estos códigos se pintarían literales en inglés.
  tooLong: "tooLong",
  invalidValue: "invalidValue",
  emptyValue: "emptyValue",
  noChanges: "noChanges",
  // Los SEIS errores de archivo completo de la carga por archivo. Vuelven como
  // {"errors": [...]} con 422 y son prosa ESPAÑOLA escrita dentro del backend,
  // así que sin clave propia se pintarían literales en una interfaz en inglés
  // —el mismo defecto que ya apareció en las Tareas 4 y 7—. Cada uno tiene su
  // clave y no una genérica, porque el dictamen de la Tarea 3 manda que el
  // motivo real del 422 se conserve: "el archivo supera el máximo de 50 filas"
  // dice mucho más que "algo salió mal", y es lo único que la pantalla no puede
  // saber sin leer el archivo.
  fileTooBig: "fileTooBig",
  fileEmpty: "fileEmpty",
  fileNoRows: "fileNoRows",
  fileNoEmailColumn: "fileNoEmailColumn",
  fileUnreadable: "fileUnreadable",
  fileTooManyRows: "fileTooManyRows",
  generic: "generic",
});

/** Estado HTTP → código, cuando el estado por sí solo ya identifica el caso. */
const POR_ESTADO = Object.freeze({
  401: ERROR_CODES.signedOut,
  403: ERROR_CODES.forbidden,
  404: ERROR_CODES.notFound,
  // 502 y 504 los devuelve el proxy de Render cuando el servicio free esta
  // despertando: es el escenario numero 1 del Review Focus del plan.
  // Sin estos, un backend que responde sin `detail` -un 500 de Django, un 405
  // por un metodo equivocado- caia en el texto crudo del Error, que antes era
  // prosa en ingles inventada por la capa de red.
  400: ERROR_CODES.generic,
  405: ERROR_CODES.generic,
  409: ERROR_CODES.already,
  422: ERROR_CODES.generic,
  // El throttle de DRF. Su `detail` es prosa INGLESA ("Request was throttled.
  // Expected available in N seconds."), asi que ademas de esta entrada hay una
  // firma de texto: sin las dos, el jefe de un cliente hispanohablante lee
  // ingles del framework.
  429: ERROR_CODES.throttled,
  500: ERROR_CODES.unavailable,
  502: ERROR_CODES.unavailable,
  503: ERROR_CODES.unavailable,
  504: ERROR_CODES.unavailable,
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
  // Texto interno del backend; sin firma se mostraria literal al cliente.
  // Los CINCO textos internos que el backend devuelve tal cual en los 409 de
  // reenviar y cancelar. Sin firma se muestran literales al jefe de un cliente,
  // y uno de ellos ENUMERA NOMBRES DE TABLAS de la base de datos. Arreglar solo
  // el del reenvio dejaba viva la mitad peor de la misma familia.
  ["solo se reenvian", ERROR_CODES.notFound],
  ["ya no esta pendiente", ERROR_CODES.notFound],
  ["ya activo su cuenta", ERROR_CODES.already],
  ["tiene datos asociados", ERROR_CODES.needsReview],
  ["tipo de invitacion desconocido", ERROR_CODES.generic],
  ["must be signed in", ERROR_CODES.signedOut],
  // Los DOS textos en ingles que el backend devuelve tal cual y que el orden de
  // `errorMessageFor` (codigo -> texto -> estado) pintaria crudos antes de
  // llegar a POR_ESTADO. El del token vencido es el mas probable de los dos:
  // `isAuthenticated()` solo comprueba que el token EXISTA, no que sirva.
  ["token not valid", ERROR_CODES.signedOut],
  ["request was throttled", ERROR_CODES.throttled],
  // Los SEIS errores de archivo completo de la carga por archivo
  // (`CsvImportError`, 422, forma `errors[]`). Van ANTES del grupo de la
  // edición a propósito: "caracteres" no los toca, pero cualquier firma futura
  // sobre "maximo" sí los tocaría, y aquí el primero que coincide gana.
  //
  // Los dos topes llevan su número y el número sale de `IMPORT_LIMITS`, que es
  // el mismo que ya decide `fileRejectionKey`: así las dos mitades de ese
  // contrato no se pueden separar en silencio. Si el backend cambiara un tope
  // sin que cambie aquí, la firma no coincide y el mensaje cae al texto del
  // backend — degradado, no roto.
  [`supera el maximo de ${IMPORT_LIMITS.maxBytes / 1024} kb`, ERROR_CODES.fileTooBig],
  [`supera el maximo de ${IMPORT_LIMITS.maxRows} filas`, ERROR_CODES.fileTooManyRows],
  // "no tiene filas de datos" va antes que nada que pudiera mirar "filas".
  ["no tiene filas de datos", ERROR_CODES.fileNoRows],
  ["el archivo esta vacio", ERROR_CODES.fileEmpty],
  ["falta la columna obligatoria", ERROR_CODES.fileNoEmailColumn],
  ["no se pudo leer el archivo", ERROR_CODES.fileUnreadable],
  // Los CUATRO mensajes del PATCH de un miembro. Llegan como
  // {errors: {campo: motivo}} y son prosa española escrita dentro del backend.
  // "caracteres" es la firma del tope de ancho ("máximo 50 caracteres"): la
  // firma NO puede ser "maximo", porque los dos errores de archivo completo
  // ("El archivo supera el máximo de 50 filas." y el de los KB) la llevan
  // también, y el dictamen de la Tarea 3 manda que esos sigan mostrando su
  // texto real, que explica el problema mejor que cualquier clave.
  ["caracteres", ERROR_CODES.tooLong],
  ["debe ser texto", ERROR_CODES.invalidValue],
  ["no puede estar vacio", ERROR_CODES.emptyValue],
  ["campos editables", ERROR_CODES.noChanges],
  ["failed to fetch", ERROR_CODES.network],
  ["network request failed", ERROR_CODES.network],
  ["load failed", ERROR_CODES.network],
];

function normalizar(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")   // marcas combinantes, con escapes
    .toLowerCase();
}

/** Texto de un error, cubriendo las DOS formas que usa el backend.
 *
 * Los errores de archivo completo NO vuelven como `detail`: vuelven como
 * `{"errors": [...]}` con 422 -de mas de 1 MB, de mas de 50 filas, vacio, sin
 * columna `correo`, ilegible-. Sin mirar ese arreglo, la carga por archivo
 * mostraria el respaldo generico en vez del motivo real. Hay precedente en
 * `src/lib/api.js`, que ya lo hace en dos endpoints.
 *
 * Acepta tambien un error que llegue como string pelado. */
function textoDeError(error) {
  if (typeof error === "string") return error;
  const e = error || {};
  // Tres formas, no dos. `errors` llega como ARREGLO en los errores de archivo
  // completo y como OBJETO por campo en la edicion de un miembro
  // (MemberEditError). Sin la segunda, la pantalla de editar mostraria el
  // mensaje generico para TODA validacion de campo. m1/m2: se descartan los
  // elementos en blanco y los que no son texto, para no pintar
  // "[object Object]" al cliente ni tragarse un `message` con firma conocida.
  const deLista = Array.isArray(e.errors)
    ? e.errors
    : (e.errors && typeof e.errors === "object" ? Object.values(e.errors) : []);
  // Los valores pueden ser strings o ARREGLOS de strings: DRF devuelve
  // {"password": ["Ensure this field has at least 8 characters."]}.
  const planos = deLista.flatMap((x) => (Array.isArray(x) ? x : [x]));
  const primero = planos.find((x) => typeof x === "string" && x.trim());
  if (primero) return primero;
  return e.message || e.detail || "";
}

function codigoDe(error) {
  const e = typeof error === "string" ? { message: error } : (error || {});
  if (e.code && Object.hasOwn(ERROR_CODES, e.code)) return ERROR_CODES[e.code];
  const mensaje = normalizar(textoDeError(e));
  for (const [firma, codigo] of POR_TEXTO) {
    if (mensaje.includes(firma)) return codigo;
  }
  return null;
}

/** Código deducido del estado HTTP. Se consulta DESPUES del texto del backend:
 *  un 422 que explica "el archivo supera el máximo de 50 filas" dice mucho más
 *  que un "algo salió mal" genérico, así que el texto manda y el estado solo
 *  cubre los casos en que el backend no dijo nada. */
function codigoPorEstado(error) {
  const e = error || {};
  return Object.hasOwn(POR_ESTADO, e.status) ? POR_ESTADO[e.status] : null;
}

/**
 * Texto que ve la persona para un error. `t` es el `useT("companyAdmin")` de la
 * pantalla.
 *
 * Orden: código reconocido → firma de texto conocida → el texto del backend →
 * estado HTTP → un mensaje genérico. Con `{ safe: true }` se salta el paso del
 * texto del backend, para pantallas públicas. Nunca devuelve cadena vacía: un fallo
 * silencioso está prohibido.
 *
 * El texto va ANTES del estado a propósito: un 422 que explica "el archivo
 * supera el máximo de 50 filas" dice mucho más que un genérico. Y el estado
 * puede ir al final sin riesgo porque `api.js` ya no inventa prosa en inglés
 * como mensaje: lo único que llega ahí es lo que el backend dijo.
 */
export function errorMessageFor(error, t, { safe = false } = {}) {
  const tr = typeof t === "function" ? t : (clave) => clave;
  const codigo = codigoDe(error);
  if (codigo) return tr(`${ERROR_KEY_PREFIX}${codigo}`, VARS_TOPES);
  // `safe` para pantallas PUBLICAS: nunca se pinta el texto crudo del backend,
  // porque bastaria un mensaje futuro que mencione una direccion para romper la
  // garantia de privacidad del backend (no revelar que un correo fue invitado).
  const crudo = safe ? "" : texto(textoDeError(error));
  if (crudo) return crudo;
  const porEstado = codigoPorEstado(error);
  if (porEstado) return tr(`${ERROR_KEY_PREFIX}${porEstado}`, VARS_TOPES);
  return tr(`${ERROR_KEY_PREFIX}${ERROR_CODES.generic}`, VARS_TOPES);
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
  // El backend lo rechaza con 422, y ademas por la forma `errors[]`, que es el
  // peor camino para mostrar el motivo. Aqui se sabe sin red.
  if (Number(file.size) === 0) return `${REJECTION_KEY_PREFIX}empty`;
  if (Number(file.size) > IMPORT_LIMITS.maxBytes) return `${REJECTION_KEY_PREFIX}tooBig`;
  return null;
}

// ── Editar a una persona ───────────────────────────────────────────────────

/**
 * Cuerpo del PATCH a partir de lo que escribió el jefe, **con los nombres que
 * exige el backend**. Es el único sitio donde se hace esa traducción, para que
 * las dos fuentes de verdad no puedan separarse sin que una prueba lo diga.
 *
 * Manda siempre los cuatro campos: el formulario los muestra todos, así que
 * todos son intención de la persona, y un cuerpo vacío es justo el caso que el
 * backend rechaza con texto interno.
 */
export function buildMemberPatch(values) {
  const v = values || {};
  return {
    usr_firstname: texto(v.firstname),
    usr_lastname: texto(v.lastname),
    usr_phone: texto(v.phone),
    lang_code: texto(v.langCode),
  };
}

/**
 * Lo que el navegador puede rechazar **sin llamar al backend**:
 * `{campo: {key, vars}}`, vacío si el cuerpo sirve.
 *
 * Existe porque los mensajes de validación del backend son prosa española
 * ("máximo 50 caracteres") y se pintarían en una interfaz en inglés; y porque
 * un viaje de red para decir lo que ya se sabe aquí es un viaje de más.
 */
export function memberEditErrors(patch) {
  const cuerpo = patch && typeof patch === "object" ? patch : {};
  const errores = {};
  for (const [campo, max] of Object.entries(EDIT_LIMITS)) {
    if (!Object.hasOwn(cuerpo, campo)) continue;
    const valor = texto(cuerpo[campo]);
    if (valor.length > max) {
      errores[campo] = { key: `${PANEL_KEY_PREFIX}tooLong`, vars: { max } };
      continue;
    }
    // El idioma es el único que el backend no acepta vacío: los otros tres se
    // guardan como nulos, que es legítimo (los 50 heredados no tienen nombre).
    if (campo === "lang_code" && !valor) {
      errores[campo] = { key: `${PANEL_KEY_PREFIX}languageRequired` };
    }
  }
  return errores;
}

/**
 * Horas que le quedan a una invitación, redondeando **hacia arriba**, o `null`
 * si no hay fecha o no se entiende.
 *
 * `null` y `0` son cosas distintas a propósito: `0` es "ya venció" y `null` es
 * "no sabemos", y pintar "vence en 0 h" sobre una fecha que no se pudo leer
 * sería afirmar algo que no se midió. Hacia arriba porque a una invitación con
 * veinte minutos de vida le queda *una hora larga* desde el punto de vista del
 * jefe, no cero.
 */
export function hoursUntilExpiry(expiresAt, now = Date.now()) {
  const crudo = texto(expiresAt);
  if (!crudo) return null;
  const fin = Date.parse(crudo);
  if (Number.isNaN(fin)) return null;
  const falta = fin - Number(now);
  if (falta <= 0) return 0;
  return Math.ceil(falta / MS_POR_HORA);
}
