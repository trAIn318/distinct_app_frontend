import { describe, it, expect } from "vitest";
import {
  ROW_STATUS,
  IMPORT_LIMITS,
  buildRoster,
  memberStatus,
  displayNameFor,
  errorMessageFor,
  previewCategoryKey,
  fileRejectionKey,
} from "../companyAdmin";

// t() de mentira: devuelve la clave marcada, así cada aserción comprueba QUÉ
// clave i18n se eligió y no el texto, que vive en los JSON (tareas 5 a 8).
const t = (key) => `T:${key}`;

/** Archivo de mentira: `File` real de jsdom es innecesario y más frágil. */
function fakeFile(name, size) {
  return { name, size, type: "" };
}

describe("ROW_STATUS", () => {
  it("expone las cinco claves y está congelado", () => {
    expect(Object.keys(ROW_STATUS).sort()).toEqual(
      ["ACTIVE", "DEACTIVATED", "EXPIRED", "INVITED", "NEVER_ENTERED"]
    );
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
    // La clave distingue el tipo: un miembro y una invitación pueden compartir id.
    expect(porCorreo["zoe@x.com"].key).not.toBe(porCorreo["nuevo@x.com"].key);
  });

  it("una invitacion vencida queda con estado vencido", () => {
    const rows = buildRoster({
      members: [],
      invitations: [{ id: 12, email: "tarde@x.com", expired: true }],
    });
    expect(rows[0].status).toBe(ROW_STATUS.EXPIRED);
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

  it("no revienta con listas vacias o ausentes", () => {
    expect(buildRoster({})).toEqual([]);
    expect(buildRoster()).toEqual([]);
    expect(buildRoster({ members: null, invitations: undefined })).toEqual([]);
    expect(buildRoster({ members: "nope", invitations: 7 })).toEqual([]);
    expect(buildRoster({ members: [null, undefined], invitations: [null] })).toEqual([]);
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
