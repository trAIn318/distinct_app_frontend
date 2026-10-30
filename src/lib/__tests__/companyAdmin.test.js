import { describe, it, expect } from "vitest";
import {
  ROW_STATUS,
  IMPORT_LIMITS,
  buildRoster,
  filterRoster,
  memberStatus,
  displayNameFor,
  errorMessageFor,
  previewCategoryKey,
  fileRejectionKey,
  EDIT_LIMITS,
  buildMemberPatch,
  memberEditErrors,
  hoursUntilExpiry,
} from "../companyAdmin";

// t() de mentira: devuelve la clave marcada, así cada aserción comprueba QUÉ
// clave i18n se eligió y no el texto, que vive en los JSON (tareas 5 a 8).
const t = (key) => `T:${key}`;

/** Archivo de mentira: `File` real de jsdom es innecesario y más frágil. */
function fakeFile(name, size) {
  return { name, size, type: "" };
}

describe("ROW_STATUS", () => {
  // Los VALORES son el contrato i18n de la columna de estado: la pantalla
  // escribe t(`status.${row.status}`). Si uno cambia, `makeT` no encuentra la
  // clave y devuelve la ruta cruda, así que el jefe de un cliente vería
  // "companyAdmin.status.ACTIVO" en pantalla. Por eso se fijan uno por uno.
  it("fija las cinco claves CON SUS VALORES y está congelado", () => {
    expect(ROW_STATUS).toEqual({
      ACTIVE: "active",
      NEVER_ENTERED: "neverEntered",
      INVITED: "invited",
      EXPIRED: "expired",
      DEACTIVATED: "deactivated",
    });
    expect(Object.isFrozen(ROW_STATUS)).toBe(true);
  });
});

describe("memberStatus", () => {
  it("activo cuando esta activo y ya entro", () => {
    expect(memberStatus({ active: true, last_login: "2026-10-01T12:00:00Z" }))
      .toBe(ROW_STATUS.ACTIVE);
  });

  it("nunca ha entrado cuando esta activo y sin last_login", () => {
    expect(memberStatus({ active: true, last_login: null })).toBe(ROW_STATUS.NEVER_ENTERED);
    expect(memberStatus({ active: true, last_login: "" })).toBe(ROW_STATUS.NEVER_ENTERED);
    expect(memberStatus({ active: true })).toBe(ROW_STATUS.NEVER_ENTERED);
  });

  it("desactivado manda sobre nunca-ha-entrado", () => {
    expect(memberStatus({ active: false, last_login: null })).toBe(ROW_STATUS.DEACTIVATED);
    expect(memberStatus({ active: false, last_login: "2026-10-01T12:00:00Z" }))
      .toBe(ROW_STATUS.DEACTIVATED);
  });

  // NO debe mirar `confirmed`: en esta base solo 13 de 159 lo tienen y los 50
  // con empresa estan todos sin confirmar usando el sistema.
  it("ignora el campo confirmed por completo", () => {
    expect(memberStatus({ active: true, confirmed: false, last_login: "2026-01-01T00:00:00Z" }))
      .toBe(ROW_STATUS.ACTIVE);
    expect(memberStatus({ active: true, confirmed: false, last_login: null }))
      .toBe(ROW_STATUS.NEVER_ENTERED);
    // Y al revés: `confirmed: true` no puede rescatar a quien está desactivado.
    expect(memberStatus({ active: false, confirmed: true, last_login: "2026-01-01T00:00:00Z" }))
      .toBe(ROW_STATUS.DEACTIVATED);
  });

  it("no revienta con una entrada nula", () => {
    expect(memberStatus(null)).toBe(ROW_STATUS.DEACTIVATED);
  });
});

describe("displayNameFor", () => {
  it("usa nombre y apellido cuando estan", () => {
    expect(displayNameFor({ firstname: "Ana", lastname: "Ruiz", email: "a@x.com" }))
      .toBe("Ana Ruiz");
  });

  // Review Focus 3: los 50 heredados pueden tenerlos vacios.
  it("cae al correo cuando no hay nombre ni apellido", () => {
    expect(displayNameFor({ firstname: null, lastname: "", email: "a@x.com" })).toBe("a@x.com");
    expect(displayNameFor({ firstname: "   ", lastname: "  ", email: "b@x.com" })).toBe("b@x.com");
    expect(displayNameFor({ email: "c@x.com" })).toBe("c@x.com");
  });

  it("tolera solo nombre o solo apellido", () => {
    expect(displayNameFor({ firstname: "Ana", lastname: null, email: "a@x.com" })).toBe("Ana");
    expect(displayNameFor({ firstname: "", lastname: "Ruiz", email: "a@x.com" })).toBe("Ruiz");
  });

  it("devuelve cadena vacia y no revienta sin datos", () => {
    expect(displayNameFor(null)).toBe("");
    expect(displayNameFor({})).toBe("");
  });
});

describe("buildRoster", () => {
  const members = [
    { id: 1, email: "zoe@x.com", firstname: "Zoe", lastname: "Ortiz", rol_id: 3, active: true, last_login: "2026-10-01T00:00:00Z" },
    { id: 2, email: "ana@x.com", firstname: null, lastname: "", rol_id: 3, active: true, last_login: null },
  ];
  const invitations = [
    { id: 11, email: "nuevo@x.com", kind: "new", status: "pending", expires_at: "2026-10-30T00:00:00Z", expired: false },
  ];

  it("une miembros e invitaciones en una sola lista", () => {
    const rows = buildRoster({ members, invitations });
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.kind).sort()).toEqual(["invitation", "member", "member"]);
    // Orden: por displayName y luego correo. "ana@x.com" (sin nombre) < "nuevo@x.com" < "Zoe Ortiz".
    expect(rows.map((r) => r.email)).toEqual(["ana@x.com", "nuevo@x.com", "zoe@x.com"]);
  });

  it("le da a cada fila su estado y una clave estable", () => {
    const rows = buildRoster({ members, invitations });
    const porCorreo = Object.fromEntries(rows.map((r) => [r.email, r]));
    expect(porCorreo["zoe@x.com"].status).toBe(ROW_STATUS.ACTIVE);
    expect(porCorreo["ana@x.com"].status).toBe(ROW_STATUS.NEVER_ENTERED);
    expect(porCorreo["nuevo@x.com"].status).toBe(ROW_STATUS.INVITED);
    expect(new Set(rows.map((r) => r.key)).size).toBe(3);
  });

  it("la clave distingue el tipo cuando el id se repite entre colecciones", () => {
    // Los ids de `users` y de `company_invitations` son secuencias distintas, así
    // que el MISMO número puede nombrar a un miembro y a una invitación. Si la
    // clave fuera solo el id, React colapsaría las dos filas en una.
    const rows = buildRoster({
      members: [{ id: 7, email: "miembro@x.com", firstname: "Mia", lastname: "Soto", rol_id: 3, active: true, last_login: null }],
      invitations: [{ id: 7, email: "invitado@x.com", expired: false }],
    });
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.key)).size).toBe(2);
  });

  it("una invitacion vencida queda con estado vencido", () => {
    const rows = buildRoster({
      members: [],
      invitations: [{ id: 12, email: "tarde@x.com", expired: true }],
    });
    expect(rows[0].status).toBe(ROW_STATUS.EXPIRED);
  });

  it("NO funde dos miembros distintos que comparten el correo en otra caja", () => {
    // `users.usr_email` es único pero SENSIBLE a mayúsculas, así que estas dos
    // filas coexisten de verdad en la base -es el escenario de las cargas
    // masivas heredadas- y el backend devuelve las dos. Fundirlas borraría a una
    // persona de la tabla y de las tres acciones de escritura, y dejaría el
    // `total` del backend diciendo 2 mientras la tabla pinta 1.
    const rows = buildRoster({
      members: [
        { id: 41, email: "Juan.Perez@hotel.com", firstname: "Juan", lastname: "Perez", rol_id: 3, active: true, last_login: null },
        { id: 88, email: "juan.perez@hotel.com", firstname: "Juan", lastname: "Perez", rol_id: 3, active: true, last_login: null },
      ],
      invitations: [],
    });
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.id).sort((a, b) => a - b)).toEqual([41, 88]);
  });

  it("cada persona aparece exactamente una vez", () => {
    // El backend ya excluye el placeholder de una invitación pendiente, pero la
    // tabla es "su gente" y una persona repetida sería un defecto visible: si el
    // mismo correo llega por las dos colecciones, gana la fila de miembro.
    const rows = buildRoster({
      members: [{ id: 1, email: "Ana@x.com", firstname: "Ana", lastname: "Ruiz", rol_id: 3, active: true, last_login: null }],
      invitations: [{ id: 11, email: "ana@x.com", expired: false }],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("member");
    expect(rows[0].status).toBe(ROW_STATUS.NEVER_ENTERED);
  });

  it("marca canAct en falso para los pares administradores", () => {
    // rol_id 4 => el backend rechaza toda escritura; la fila no lleva acciones.
    const rows = buildRoster({
      members: [
        { id: 1, email: "par@x.com", firstname: "Par", lastname: "Jefe", rol_id: 4, active: true, last_login: null },
        { id: 2, email: "equipo@x.com", firstname: "Equipo", lastname: "Uno", rol_id: 3, active: true, last_login: null },
      ],
      invitations: [],
    });
    const porCorreo = Object.fromEntries(rows.map((r) => [r.email, r]));
    expect(porCorreo["par@x.com"].canAct).toBe(false);
    expect(porCorreo["equipo@x.com"].canAct).toBe(true);
  });

  it("una invitacion se identifica por su correo porque no trae nombre", () => {
    const rows = buildRoster({ members: [], invitations });
    expect(rows[0].displayName).toBe("nuevo@x.com");
    expect(rows[0].canAct).toBe(true);
    expect(rows[0].id).toBe(11);
  });

  it("ordena por nombre y desempata por correo", () => {
    const rows = buildRoster({
      members: [
        { id: 1, email: "zoe@x.com", firstname: "Ana", lastname: "Ruiz", rol_id: 3, active: true, last_login: null },
        { id: 2, email: "ana@x.com", firstname: "Ana", lastname: "Ruiz", rol_id: 3, active: true, last_login: null },
      ],
      invitations: [],
    });
    expect(rows.map((r) => r.email)).toEqual(["ana@x.com", "zoe@x.com"]);
  });

  it("un nombre que es prefijo de otro va primero", () => {
    // Con los 50 heredados sin nombre el displayName ES el correo, así que los
    // prefijos abundan: "ana@x.com" es prefijo de nada, pero "Ana" sí lo es de
    // "Ana Beta". Si el correo se cuela en la comparación primaria, "Ana" cae al
    // final de su propio grupo.
    const rows = buildRoster({
      members: [
        { id: 1, email: "zb@x.com", firstname: "Ana", lastname: "Beta", rol_id: 3, active: true, last_login: null },
        { id: 2, email: "za@x.com", firstname: "Ana", lastname: "", rol_id: 3, active: true, last_login: null },
        { id: 3, email: "zc@x.com", firstname: "Ana", lastname: "Zeta", rol_id: 3, active: true, last_login: null },
      ],
      invitations: [],
    });
    expect(rows.map((r) => r.displayName)).toEqual(["Ana", "Ana Beta", "Ana Zeta"]);
  });

  it("no revienta con listas vacias o ausentes", () => {
    expect(buildRoster({})).toEqual([]);
    expect(buildRoster()).toEqual([]);
    expect(buildRoster({ members: null, invitations: undefined })).toEqual([]);
    expect(buildRoster({ members: [null, undefined], invitations: [null] })).toEqual([]);
  });

  it("no revienta con colecciones que no se pueden iterar", () => {
    // Un string SÍ se itera (carácter por carácter) y lo tapaba el filtro de
    // filas sin correo, así que no probaba el guard. Un número y un objeto
    // plano no son iterables: sin `Array.isArray` esto lanza TypeError.
    expect(() => buildRoster({ members: 7, invitations: { a: 1 } })).not.toThrow();
    expect(buildRoster({ members: 7, invitations: { a: 1 } })).toEqual([]);
    expect(buildRoster({ members: true, invitations: 0 })).toEqual([]);
  });

  it("descarta una fila en blanco en vez de pintar una persona sin identidad", () => {
    // Una fila sin nombre y sin correo no identifica a nadie: ocuparía un renglón
    // de la tabla sin decir de quién es ni permitir ninguna acción.
    const rows = buildRoster({
      members: [
        { id: 1, email: "", firstname: "", lastname: null, rol_id: 3, active: true, last_login: null },
        { id: 2, email: "  ", firstname: null, lastname: "  ", rol_id: 3, active: true, last_login: null },
        { id: 3, email: "real@x.com", firstname: "Real", lastname: "Persona", rol_id: 3, active: true, last_login: null },
      ],
      invitations: [
        { id: 11, email: "", expired: false },
        { id: 12, email: null, expired: false },
      ],
    });
    expect(rows.map((r) => r.email)).toEqual(["real@x.com"]);
  });
});

describe("filterRoster", () => {
  // El backend filtra con ?q= SOLO a los miembros: las invitaciones vuelven sin
  // filtrar y sin nombre. Este filtro de navegador es la otra mitad de la
  // búsqueda mixta que fija el diseño, y vive aquí para poder probarlo sin DOM.
  const rows = [
    { key: "member:1", kind: "member", id: 1, email: "ana@hotel.com", displayName: "Ana Muñoz", status: ROW_STATUS.ACTIVE, canAct: true },
    { key: "member:2", kind: "member", id: 2, email: "bruno@hotel.com", displayName: "bruno@hotel.com", status: ROW_STATUS.NEVER_ENTERED, canAct: true },
    { key: "invitation:11", kind: "invitation", id: 11, email: "Carlos@Hotel.com", displayName: "Carlos@Hotel.com", status: ROW_STATUS.INVITED, canAct: true },
  ];

  it("sin busqueda devuelve todo", () => {
    expect(filterRoster(rows, "")).toEqual(rows);
    expect(filterRoster(rows, "   ")).toEqual(rows);
    expect(filterRoster(rows, null)).toEqual(rows);
    expect(filterRoster(rows)).toEqual(rows);
  });

  it("filtra por nombre y por correo", () => {
    expect(filterRoster(rows, "ana").map((r) => r.id)).toEqual([1]);
    expect(filterRoster(rows, "bruno@").map((r) => r.id)).toEqual([2]);
    expect(filterRoster(rows, "hotel.com").map((r) => r.id)).toEqual([1, 2, 11]);
  });

  it("compara sin acentos ni mayusculas", () => {
    expect(filterRoster(rows, "MUNOZ").map((r) => r.id)).toEqual([1]);
    expect(filterRoster(rows, "muñoz").map((r) => r.id)).toEqual([1]);
    expect(filterRoster(rows, "carlos").map((r) => r.id)).toEqual([11]);
  });

  it("devuelve lista vacia cuando nada coincide, y no revienta con entradas raras", () => {
    expect(filterRoster(rows, "zzz")).toEqual([]);
    expect(filterRoster(null, "ana")).toEqual([]);
    expect(filterRoster(undefined)).toEqual([]);
    expect(filterRoster("nope", "ana")).toEqual([]);
  });
});

describe("errorMessageFor", () => {
  it("traduce los casos conocidos del backend por su codigo", () => {
    expect(errorMessageFor({ code: "already" }, t)).toBe("T:errors.already");
    expect(errorMessageFor({ code: "rejected" }, t)).toBe("T:errors.rejected");
    expect(errorMessageFor({ status: 403 }, t)).toBe("T:errors.forbidden");
    expect(errorMessageFor({ status: 404 }, t)).toBe("T:errors.notFound");
  });

  it("reconoce los textos en espanol que el backend trae hoy", () => {
    // Estos mensajes están escritos en español dentro del backend y esta
    // pantalla es la primera impresión de un cliente que puede estar en inglés.
    expect(errorMessageFor(new Error("Esta persona ya es miembro o ya tiene una invitación vigente."), t))
      .toBe("T:errors.already");
    expect(errorMessageFor(new Error("Este correo no se puede incorporar a su compañía."), t))
      .toBe("T:errors.rejected");
    expect(errorMessageFor(new Error("Correo inválido."), t)).toBe("T:errors.invalidEmail");
    expect(errorMessageFor(new Error("Sin compañía asignada."), t)).toBe("T:errors.noCompany");
  });

  it("reconoce los casos del frontend y de la red", () => {
    expect(errorMessageFor(new Error("You must be signed in."), t)).toBe("T:errors.signedOut");
    expect(errorMessageFor(new TypeError("Failed to fetch"), t)).toBe("T:errors.network");
  });

  it("usa el texto del backend como ultimo recurso", () => {
    expect(errorMessageFor(new Error("El cuerpo debe ser un objeto JSON."), t))
      .toBe("El cuerpo debe ser un objeto JSON.");
  });

  it("da un mensaje generico cuando no hay ni codigo ni texto", () => {
    expect(errorMessageFor(null, t)).toBe("T:errors.generic");
    expect(errorMessageFor(new Error(""), t)).toBe("T:errors.generic");
    expect(errorMessageFor({}, t)).toBe("T:errors.generic");
  });
});

describe("previewCategoryKey", () => {
  it("nombra las cinco categorias de la previsualizacion", () => {
    expect(previewCategoryKey("invite")).toBe("import.category.invite");
    expect(previewCategoryKey("join")).toBe("import.category.join");
    expect(previewCategoryKey("already")).toBe("import.category.already");
    expect(previewCategoryKey("rejected")).toBe("import.category.rejected");
    expect(previewCategoryKey("invalid")).toBe("import.category.invalid");
  });

  it("nombra tambien la fila que fallo al escribir, que solo sale al confirmar", () => {
    expect(previewCategoryKey("error")).toBe("import.category.error");
  });

  it("no devuelve undefined ante una categoria que no conoce", () => {
    expect(previewCategoryKey("futuro")).toBe("import.category.unknown");
    expect(previewCategoryKey(null)).toBe("import.category.unknown");
  });
});

describe("fileRejectionKey", () => {
  // Review Focus 5
  it("rechaza lo que no es csv", () => {
    expect(fileRejectionKey(fakeFile("equipo.xlsx", 100))).toBe("import.reject.notCsv");
    expect(fileRejectionKey(fakeFile("equipo.zip", 100))).toBe("import.reject.notCsv");
    expect(fileRejectionKey(fakeFile("equipo", 100))).toBe("import.reject.notCsv");
  });

  it("rechaza por encima de 1 MB", () => {
    expect(fileRejectionKey(fakeFile("equipo.csv", IMPORT_LIMITS.maxBytes + 1)))
      .toBe("import.reject.tooBig");
  });

  it("acepta un csv normal", () => {
    expect(fileRejectionKey(fakeFile("equipo.csv", 2048))).toBeNull();
    expect(fileRejectionKey(fakeFile("Equipo.CSV", IMPORT_LIMITS.maxBytes))).toBeNull();
  });

  it("no se queja cuando todavia no hay archivo elegido", () => {
    expect(fileRejectionKey(null)).toBeNull();
    expect(fileRejectionKey(undefined)).toBeNull();
  });

  it("publica los topes que el backend impone", () => {
    expect(IMPORT_LIMITS).toEqual({ maxBytes: 1024 * 1024, maxRows: 50 });
    expect(Object.isFrozen(IMPORT_LIMITS)).toBe(true);
  });
});

describe("el modulo es logica pura", () => {
  it("no importa red, React ni Next", async () => {
    // Lo que lo hace probable al 100%: si alguien mete un fetch o un hook aquí,
    // esta prueba lo dice antes que la revisión.
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    // `import.meta.url` no es un file:// bajo el transformador de Vitest, así
    // que el archivo se lee desde la raíz del proyecto, que es el cwd de vitest.
    const src = readFileSync(resolve(process.cwd(), "src/lib/companyAdmin.js"), "utf8");
    expect(src).not.toMatch(/\bfetch\s*\(/);
    expect(src).not.toMatch(/from\s+["'](react|next\/|\.\/api|\.\/session)/);
    expect(src).not.toMatch(/^\s*import\b/m);
  });
});

describe("lo que la revision encontro sin cercar", () => {
  it("una fila de miembro y una de invitacion con el MISMO id no comparten key", () => {
    // La prueba anterior comparaba id 1 contra id 11, asi que no probaba lo que
    // decia: sin el prefijo, React recibiria dos keys iguales.
    const r = buildRoster({
      members: [{ id: 11, email: "m@x.com", firstname: "M", rol_id: 3, active: true, last_login: null }],
      invitations: [{ id: 11, email: "i@x.com", expired: false }],
    });
    expect(new Set(r.map((f) => f.key)).size).toBe(2);
    expect(r.map((f) => f.key).sort()).toEqual(["invitation:11", "member:11"]);
  });

  it("members no iterable no revienta (un string SI se itera, por eso no servia)", () => {
    expect(buildRoster({ members: 7 })).toEqual([]);
    expect(buildRoster({ members: { a: 1 } })).toEqual([]);
    expect(buildRoster({ invitations: 7 })).toEqual([]);
  });

  it("descarta la fila sin correo ni nombre, y la invitacion sin correo", () => {
    expect(buildRoster({ members: [{ id: 1, email: "", firstname: "", lastname: "" }] })).toEqual([]);
    expect(buildRoster({ invitations: [{ id: 2, email: "", expired: false }] })).toEqual([]);
  });

  it("502 y 504 se tratan como servicio no disponible, igual que 503", () => {
    // Son los que devuelve el proxy de Render cuando el servicio free despierta.
    for (const status of [502, 503, 504]) {
      expect(errorMessageFor({ status }, t)).toBe("T:errors.unavailable");
    }
  });

  it("lee la segunda forma de error del backend: errors[]", () => {
    // Los errores de archivo completo vuelven asi, no como `detail`.
    expect(errorMessageFor({ status: 422, errors: ["El archivo supera el máximo de 50 filas."] }, t))
      .toBe("El archivo supera el máximo de 50 filas.");
  });

  it("un error que llega como string pelado conserva su texto y su firma", () => {
    expect(errorMessageFor("Esta persona ya es miembro o ya tiene una invitación vigente.", t))
      .toBe("T:errors.already");
    expect(errorMessageFor("Algo raro y sin firma", t)).toBe("Algo raro y sin firma");
  });

  it("el 409 de reenviar una invitacion no pendiente se traduce, no se muestra crudo", () => {
    expect(errorMessageFor({ status: 409, detail: "solo se reenvian invitaciones pendientes" }, t))
      .toBe("T:errors.notFound");
  });

  it("rechaza el archivo vacio sin ir al backend", () => {
    expect(fileRejectionKey({ name: "lista.csv", size: 0 })).toBe("import.reject.empty");
    expect(fileRejectionKey({ name: "lista.csv", size: 10 })).toBeNull();
  });
});

describe("lo que encontro la re-revision", () => {
  it("filterRoster busca en los MISMOS campos que el ?q= del backend", () => {
    // El backend busca en usr_name | usr_email | usr_firstname | usr_lastname.
    // Con dos campos, buscar por el nombre de usuario encontraba a la persona
    // en el servidor y este filtro la escondia: tabla vacia con el contador
    // diciendo 1. Es el caso mas natural de busqueda.
    const r = buildRoster({
      members: [{ id: 1, name: "jperez", email: "juan@hotel.com",
                  firstname: "Juan", lastname: "Perez", rol_id: 3,
                  active: true, last_login: null }],
    });
    expect(filterRoster(r, "jperez").map((f) => f.id)).toEqual([1]);
    expect(filterRoster(r, "juan").map((f) => f.id)).toEqual([1]);
    expect(filterRoster(r, "perez").map((f) => f.id)).toEqual([1]);
  });

  it("el NOMBRE es la clave primaria del orden, no el correo", () => {
    // Las pruebas anteriores usaban datos donde los dos criterios coincidian,
    // asi que hacer del correo la clave primaria pasaba en verde.
    const r = buildRoster({
      members: [
        { id: 1, email: "zz@x.com", firstname: "Ana", rol_id: 3, active: true, last_login: null },
        { id: 2, email: "aa@x.com", firstname: "Ana", lastname: "Beta", rol_id: 3, active: true, last_login: null },
      ],
    });
    expect(r.map((f) => f.displayName)).toEqual(["Ana", "Ana Beta"]);
  });

  it("el orden usa un idioma explicito y no el del sistema", () => {
    // Sin idioma explicito, localeCompare usa el del runtime y dos personas con
    // el mismo panel ven dos ordenes distintos.
    const r = buildRoster({
      members: [
        { id: 1, email: "a@x.com", firstname: "Zoe", rol_id: 3, active: true, last_login: null },
        { id: 2, email: "b@x.com", firstname: "Ángel", rol_id: 3, active: true, last_login: null },
        { id: 3, email: "c@x.com", firstname: "Ñandu", rol_id: 3, active: true, last_login: null },
      ],
    });
    // En "en", los acentuados se plegan a su base: Angel, Nandu, Zoe.
    expect(r.map((f) => f.displayName)).toEqual(["Ángel", "Ñandu", "Zoe"]);
  });

  it("traduce los cuatro textos internos de cancelar, sin filtrar nombres de tablas", () => {
    expect(errorMessageFor({ status: 409, detail: "la invitación ya no está pendiente" }, t))
      .toBe("T:errors.notFound");
    expect(errorMessageFor({ status: 409, detail: "el usuario invitado ya activó su cuenta" }, t))
      .toBe("T:errors.already");
    const conTablas = errorMessageFor(
      { status: 409, detail: "el usuario invitado tiene datos asociados: analytics.user_property, evaluations" }, t);
    expect(conTablas).toBe("T:errors.needsReview");
    expect(conTablas).not.toContain("analytics.");
    expect(conTablas).not.toContain("evaluations");
  });

  it("lee la TERCERA forma de error: errors como objeto por campo", () => {
    // MemberEditError responde {"errors": {campo: motivo}} con 400. Sin esto, la
    // pantalla de editar mostraria el generico para TODA validacion de campo.
    //
    // TAREA 7: el motivo de ejemplo era "no puede estar vacío", que desde esta
    // tarea TIENE firma y se traduce. La garantia que esta prueba sostiene es
    // que la forma de objeto por campo SE LEE, no que su texto quede crudo, asi
    // que el ejemplo pasa a ser un motivo sin firma -lo que le ocurriria a un
    // mensaje de campo que el backend agregue manana- y se fija aparte que los
    // motivos conocidos de hoy si se traducen.
    expect(errorMessageFor({ status: 400, errors: { firstname: "formato no reconocido" } }, t))
      .toBe("formato no reconocido");
    expect(errorMessageFor({ status: 400, errors: { usr_firstname: "no puede estar vacío" } }, t))
      .toBe("T:errors.emptyValue");
  });

  it("descarta elementos de errors en blanco o que no son texto", () => {
    // Sin esto se tragaba un message con firma conocida, o pintaba
    // "[object Object]" al cliente.
    expect(errorMessageFor({ errors: [null], message: "ya es miembro" }, t)).toBe("T:errors.already");
    expect(errorMessageFor({ errors: ["   "], detail: "ya es miembro" }, t)).toBe("T:errors.already");
    expect(errorMessageFor({ status: 422, errors: [{ row: 3 }] }, t)).not.toContain("[object");
  });

  it("filterRoster no comparte el arreglo con la entrada ni revienta con filas nulas", () => {
    const rows = [{ key: "k", kind: "member", id: 1, email: "a@x.com", displayName: "Ana" }, null];
    const out = filterRoster(rows, "");
    expect(out).not.toBe(rows);
    out.push({ key: "z" });
    expect(rows).toHaveLength(2);
    expect(() => filterRoster(rows, "ana")).not.toThrow();
    expect(filterRoster(rows, "ana").map((f) => f.id)).toEqual([1]);
  });

  it("un archivo que no es csv Y esta vacio se reporta como no-csv", () => {
    // La extension es lo mas accionable para quien sube el archivo.
    expect(fileRejectionKey({ name: "lista.pdf", size: 0 })).toBe("import.reject.notCsv");
  });
});

describe("los dos textos crudos que el backend pinta en ingles", () => {
  it("I3: el 401 de un token vencido se traduce, no se muestra crudo", () => {
    // `isAuthenticated()` solo comprueba que EXISTA un token, no que sirva, asi
    // que un token vencido pasa el guard y el primer GET es un 401 cuyo detail
    // es "Given token not valid for any token type". El orden de
    // `errorMessageFor` consulta el texto del backend ANTES del estado (Tarea
    // 3, no se reabre), asi que lo que lo arregla es una FIRMA de texto.
    expect(errorMessageFor({ status: 401, detail: "Given token not valid for any token type" }, t))
      .toBe("T:errors.signedOut");
    // Y tambien desde una pantalla que no mira el estado.
    expect(errorMessageFor(new Error("Given token not valid for any token type"), t))
      .toBe("T:errors.signedOut");
  });

  it("I4: el 429 del throttle tiene su propio codigo, por texto y por estado", () => {
    expect(errorMessageFor(
      { status: 429, detail: "Request was throttled. Expected available in 42 seconds." },
      t,
    )).toBe("T:errors.throttled");
    // Sin `detail` el estado solo ya identifica el caso.
    expect(errorMessageFor({ status: 429 }, t)).toBe("T:errors.throttled");
  });
});

// ── Tarea 7 — las acciones sobre una persona ────────────────────────────────

describe("EDIT_LIMITS y buildMemberPatch — la trampa de los nombres", () => {
  it("publica los cuatro topes que impone el backend, congelados", () => {
    expect(EDIT_LIMITS).toEqual({
      usr_firstname: 50,
      usr_lastname: 50,
      usr_phone: 20,
      lang_code: 10,
    });
    expect(Object.isFrozen(EDIT_LIMITS)).toBe(true);
  });

  it("el cuerpo del PATCH usa los nombres de ESCRITURA, no los de lectura", () => {
    // El GET devuelve firstname/lastname/phone/lang_code y el PATCH exige
    // usr_firstname/usr_lastname/usr_phone/lang_code: solo UNO de los cuatro
    // coincide. El backend descarta en silencio toda clave fuera de su lista
    // blanca, asi que mandar los de lectura no da error: GUARDA SIN GUARDAR
    // NADA, o responde "no hay campos editables en la solicitud".
    expect(buildMemberPatch({
      firstname: "Ana",
      lastname: "Bravo",
      phone: "+57 300 000 0000",
      langCode: "es",
    })).toEqual({
      usr_firstname: "Ana",
      usr_lastname: "Bravo",
      usr_phone: "+57 300 000 0000",
      lang_code: "es",
    });
  });

  it("recorta los espacios y convierte lo ausente en cadena vacia", () => {
    expect(buildMemberPatch({ firstname: "  Ana  ", lastname: null, langCode: "en" }))
      .toEqual({ usr_firstname: "Ana", usr_lastname: "", usr_phone: "", lang_code: "en" });
    expect(buildMemberPatch()).toEqual({
      usr_firstname: "", usr_lastname: "", usr_phone: "", lang_code: "",
    });
  });

  it("no deja pasar ninguna clave de lectura ni de privilegio", () => {
    const cuerpo = buildMemberPatch({
      firstname: "Ana", lastname: "B", phone: "1", langCode: "en",
      rol_id: 1, comp_id: 9, usr_active: true, email: "otra@x.com",
    });
    expect(Object.keys(cuerpo).sort())
      .toEqual(["lang_code", "usr_firstname", "usr_lastname", "usr_phone"]);
  });
});

describe("memberEditErrors — la validacion que evita el mensaje del backend", () => {
  it("acepta un cuerpo dentro de los topes", () => {
    expect(memberEditErrors(buildMemberPatch({
      firstname: "Ana", lastname: "Bravo", phone: "3000000", langCode: "es",
    }))).toEqual({});
  });

  it("senala el campo que pasa de su tope, con el tope en la variable", () => {
    const errores = memberEditErrors({
      usr_firstname: "A".repeat(51),
      usr_lastname: "B".repeat(50),
      usr_phone: "9".repeat(21),
      lang_code: "es",
    });
    expect(errores.usr_firstname).toEqual({ key: "panel.tooLong", vars: { max: 50 } });
    expect(errores.usr_phone).toEqual({ key: "panel.tooLong", vars: { max: 20 } });
    expect(errores.usr_lastname).toBeUndefined();
  });

  it("el idioma no puede quedar vacio: el backend lo rechaza con prosa espanola", () => {
    expect(memberEditErrors({ usr_firstname: "Ana", lang_code: "" }))
      .toEqual({ lang_code: { key: "panel.languageRequired" } });
  });

  it("no revienta con un cuerpo que no es objeto", () => {
    expect(memberEditErrors(null)).toEqual({});
    expect(memberEditErrors("nope")).toEqual({});
  });
});

describe("hoursUntilExpiry — las 72 h de la invitacion, en texto", () => {
  const AHORA = Date.UTC(2026, 9, 30, 12, 0, 0);

  it("dice cuantas horas quedan, redondeando hacia arriba", () => {
    expect(hoursUntilExpiry(new Date(AHORA + 72 * 3600_000).toISOString(), AHORA)).toBe(72);
    expect(hoursUntilExpiry(new Date(AHORA + 2.1 * 3600_000).toISOString(), AHORA)).toBe(3);
    // Menos de una hora NO es cero: el jefe tiene que saber que todavia sirve.
    expect(hoursUntilExpiry(new Date(AHORA + 60_000).toISOString(), AHORA)).toBe(1);
  });

  it("una invitacion ya vencida da 0, nunca un negativo", () => {
    expect(hoursUntilExpiry(new Date(AHORA - 3600_000).toISOString(), AHORA)).toBe(0);
    expect(hoursUntilExpiry(new Date(AHORA).toISOString(), AHORA)).toBe(0);
  });

  it("sin fecha, o con una fecha ilegible, devuelve null y no 0", () => {
    // 0 pintaria "vence en 0 h" sobre una invitacion cuya fecha no conocemos.
    expect(hoursUntilExpiry(null, AHORA)).toBeNull();
    expect(hoursUntilExpiry("", AHORA)).toBeNull();
    expect(hoursUntilExpiry("manana", AHORA)).toBeNull();
    expect(hoursUntilExpiry(undefined, AHORA)).toBeNull();
  });
});

describe("buildRoster lleva la fecha de vencimiento a la fila de la invitacion", () => {
  it("la fila de una invitacion trae expiresAt, y la de un miembro no", () => {
    const r = buildRoster({
      members: [{ id: 1, email: "m@x.com", firstname: "M", rol_id: 3, active: true, last_login: null }],
      invitations: [{ id: 7, email: "i@x.com", expired: false, expires_at: "2026-11-02T12:00:00Z" }],
    });
    const inv = r.find((f) => f.kind === "invitation");
    const mem = r.find((f) => f.kind === "member");
    expect(inv.expiresAt).toBe("2026-11-02T12:00:00Z");
    expect(mem.expiresAt).toBeUndefined();
  });

  it("una invitacion sin expires_at trae cadena vacia, no undefined de un null", () => {
    const r = buildRoster({ invitations: [{ id: 7, email: "i@x.com", expired: false }] });
    expect(r[0].expiresAt).toBe("");
  });
});

describe("los cuatro mensajes del PATCH que el backend manda en espanol", () => {
  // Espejo exacto del Critical 2 de la Tarea 4: `errorMessageFor` usa el texto
  // crudo como PENULTIMO recurso, asi que sin firma estas frases se pintan
  // literalmente en una interfaz en ingles. Llegan como {errors: {campo: motivo}}
  // (MemberEditError), la forma de objeto por campo que el modulo ya sabe leer.
  it("maximo N caracteres", () => {
    expect(errorMessageFor({ status: 400, errors: { usr_firstname: "máximo 50 caracteres" } }, t))
      .toBe("T:errors.tooLong");
    expect(errorMessageFor({ status: 400, errors: { usr_phone: "máximo 20 caracteres" } }, t))
      .toBe("T:errors.tooLong");
  });

  it("debe ser texto", () => {
    expect(errorMessageFor({ status: 400, errors: { usr_lastname: "debe ser texto" } }, t))
      .toBe("T:errors.invalidValue");
  });

  it("no puede estar vacio", () => {
    expect(errorMessageFor({ status: 400, errors: { lang_code: "no puede estar vacío" } }, t))
      .toBe("T:errors.emptyValue");
  });

  it("no hay campos editables en la solicitud", () => {
    expect(errorMessageFor({ status: 400, errors: { detail: "no hay campos editables en la solicitud" } }, t))
      .toBe("T:errors.noChanges");
  });

  it("y la firma de los caracteres NO se come los topes del archivo", () => {
    // El dictamen de la Tarea 3 dice que un 422 que explica el motivo real vale
    // mas que un generico, asi que estos DOS tienen que seguir cayendo al texto
    // crudo del backend. Una firma por "maximo" se los habria tragado.
    expect(errorMessageFor({ status: 422, errors: ["El archivo supera el máximo de 50 filas."] }, t))
      .toBe("El archivo supera el máximo de 50 filas.");
    expect(errorMessageFor({ status: 422, errors: ["El archivo supera el máximo de 1024 KB."] }, t))
      .toBe("El archivo supera el máximo de 1024 KB.");
  });
});
