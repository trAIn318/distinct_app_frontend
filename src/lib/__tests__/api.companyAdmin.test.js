import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const getAccessToken = vi.fn();
vi.mock("../session", () => ({ getAccessToken: (...a) => getAccessToken(...a) }));

import {
  getInvitationInfo,
  acceptInvitation,
  getCompanyMembers,
  addCompanyMember,
  resendInvitation,
  cancelInvitation,
  updateCompanyMember,
  deactivateCompanyMember,
  activateCompanyMember,
  unlinkCompanyMember,
  getImportTemplate,
  previewMembersImport,
  commitMembersImport,
} from "../api";

let fetchMock;

/** Respuesta de fetch con el cuerpo y el estado dados. */
function respuesta(body, { ok = true, status = 200, text } = {}) {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => (text !== undefined ? text : JSON.stringify(body)),
  };
}

beforeEach(() => {
  getAccessToken.mockReset().mockReturnValue("tok-123");
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Las opciones con las que se llamo a fetch en la ultima invocacion. */
function ultimaLlamada() {
  const [url, opts] = fetchMock.mock.calls.at(-1);
  return { url, opts: opts || {} };
}

describe("endpoints publicos de la invitacion", () => {
  it("getInvitationInfo NO manda Authorization: la pantalla es publica", async () => {
    fetchMock.mockResolvedValue(respuesta({ kind: "new", company_name: "T2T" }));
    const info = await getInvitationInfo("abc.def");
    expect(info).toEqual({ kind: "new", company_name: "T2T" });
    const { url, opts } = ultimaLlamada();
    expect(url).toContain("/api/invitations/abc.def/");
    expect(opts.headers || {}).not.toHaveProperty("Authorization");
    // Y no debe exigir sesion ni consultarla.
    expect(getAccessToken).not.toHaveBeenCalled();
  });

  it("acceptInvitation tampoco, y manda el consentimiento que el backend exige", async () => {
    fetchMock.mockResolvedValue(respuesta({ access: "a", refresh: "r", user: { id: 9 } }));
    const sesion = await acceptInvitation("tkn", {
      password: "Correct123!",
      confirmPassword: "Correct123!",
      acceptPolicy: true,
    });
    expect(sesion.user.id).toBe(9);
    const { url, opts } = ultimaLlamada();
    expect(url).toContain("/api/invitations/tkn/accept/");
    expect(opts.method).toBe("POST");
    expect(opts.headers).not.toHaveProperty("Authorization");
    // Sin accept_policy el backend rechaza con 400: tiene que viajar.
    expect(JSON.parse(opts.body)).toEqual({
      password: "Correct123!",
      confirm_password: "Correct123!",
      accept_policy: true,
    });
  });

  it("acceptInvitation de una cuenta existente no manda contrasena", async () => {
    // La variante de un clic: el backend ignora el cuerpo para kind=join.
    fetchMock.mockResolvedValue(respuesta({ access: "a", refresh: "r", user: { id: 1 } }));
    await acceptInvitation("tkn", {});
    expect(JSON.parse(ultimaLlamada().opts.body)).toEqual({});
  });

  it("codifica el token en la URL", async () => {
    fetchMock.mockResolvedValue(respuesta({ kind: "new", company_name: "X" }));
    await getInvitationInfo("a/b?c=d");
    expect(ultimaLlamada().url).toContain(encodeURIComponent("a/b?c=d"));
  });
});

describe("endpoints autenticados del panel", () => {
  it("getCompanyMembers manda el Bearer y arma el query", async () => {
    fetchMock.mockResolvedValue(respuesta({ members: [], invitations: [], total: 0 }));
    await getCompanyMembers({ q: "ana muñoz", limit: 25, offset: 50 });
    const { url, opts } = ultimaLlamada();
    expect(opts.headers.Authorization).toBe("Bearer tok-123");
    expect(url).toContain("q=ana+mu%C3%B1oz");
    expect(url).toContain("limit=25");
    expect(url).toContain("offset=50");
  });

  it("omite del query lo que no se paso", async () => {
    fetchMock.mockResolvedValue(respuesta({ members: [], invitations: [], total: 0 }));
    await getCompanyMembers();
    const { url } = ultimaLlamada();
    expect(url).not.toContain("q=");
    expect(url).not.toContain("undefined");
  });

  it("lanza 'You must be signed in.' si no hay token", async () => {
    getAccessToken.mockReturnValue(null);
    await expect(getCompanyMembers()).rejects.toThrow("You must be signed in.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("addCompanyMember devuelve la invitacion y si el correo salio", async () => {
    fetchMock.mockResolvedValue(
      respuesta({ invitation: { id: 3 }, email_sent: false }, { status: 201 }));
    const r = await addCompanyMember("nuevo@x.com");
    expect(r.email_sent).toBe(false);
    const { url, opts } = ultimaLlamada();
    expect(url).toContain("/api/company-admin/members/");
    expect(JSON.parse(opts.body)).toEqual({ email: "nuevo@x.com" });
  });

  it("las acciones sobre una persona golpean su ruta y su metodo", async () => {
    fetchMock.mockResolvedValue(respuesta({}));
    await updateCompanyMember(7, { usr_firstname: "Ana" });
    expect(ultimaLlamada().opts.method).toBe("PATCH");
    expect(ultimaLlamada().url).toContain("/api/company-admin/members/7/");

    await deactivateCompanyMember(7);
    expect(ultimaLlamada().url).toContain("/members/7/deactivate/");
    expect(ultimaLlamada().opts.method).toBe("POST");

    await unlinkCompanyMember(7);
    expect(ultimaLlamada().url).toContain("/members/7/unlink/");

    await resendInvitation(11);
    expect(ultimaLlamada().url).toContain("/invitations/11/resend/");

    await cancelInvitation(11);
    expect(ultimaLlamada().url).toContain("/invitations/11/");
    expect(ultimaLlamada().opts.method).toBe("DELETE");
  });

  it("devolver el acceso golpea /activate/ y NO /deactivate/", async () => {
    // La ruta se ancla con una expresion regular, NO con una subcadena:
    // ".../members/7/deactivate/" CONTIENE "activate/", asi que un
    // `toContain("/activate/")` lo daria por bueno aunque la peticion fuera a
    // quitar el acceso. Es el mismo error de metodo que ya costo dos defectos
    // en esta sesion: medir una subcadena en vez del hecho.
    fetchMock.mockResolvedValue(respuesta({ member: { id: 7, active: true } }));
    await activateCompanyMember(7);
    const { url, opts } = ultimaLlamada();
    expect(url).toMatch(/\/api\/company-admin\/members\/7\/activate\/$/);
    expect(url).not.toMatch(/deactivate/);
    expect(opts.method).toBe("POST");
    expect(opts.headers.Authorization).toBe("Bearer tok-123");
  });

  it("y un error del backend llega con su estado, para poder traducirlo", async () => {
    // Carry de la Tarea 3: el Error tiene que llevar `status`, porque el
    // backend no manda ningun campo `code` y el orden de `errorMessageFor` lo
    // usa. Sin esto un 404 se pintaria en el espanol del backend.
    fetchMock.mockResolvedValue(respuesta({ detail: "Not found." }, { ok: false, status: 404 }));
    await expect(activateCompanyMember(7)).rejects.toMatchObject({ status: 404 });
  });
});

describe("errores", () => {
  it("lanza el detail del backend cuando la respuesta no es ok", async () => {
    fetchMock.mockResolvedValue(
      respuesta({ detail: "Esta persona ya es miembro." }, { ok: false, status: 409 }));
    await expect(addCompanyMember("x@y.com")).rejects.toThrow("Esta persona ya es miembro.");
  });

  it("adjunta el ESTADO al error, que el patron del repo perdia", async () => {
    // Sin el estado, companyAdmin.errorMessageFor solo puede traducir por texto.
    fetchMock.mockResolvedValue(respuesta({ detail: "nope" }, { ok: false, status: 403 }));
    await expect(addCompanyMember("x@y.com")).rejects.toMatchObject({ status: 403 });
  });

  it("adjunta tambien el arreglo errors, que es como vuelven los de archivo", async () => {
    fetchMock.mockResolvedValue(respuesta(
      { errors: ["El archivo supera el máximo de 50 filas."] }, { ok: false, status: 422 }));
    await expect(previewMembersImport(new File(["x"], "a.csv")))
      .rejects.toMatchObject({ status: 422, errors: ["El archivo supera el máximo de 50 filas."] });
  });

  it("un cuerpo que no es JSON no tumba la llamada", async () => {
    fetchMock.mockResolvedValue({
      ok: false, status: 500,
      json: async () => { throw new Error("not json"); },
      text: async () => "<html>500</html>",
    });
    await expect(getCompanyMembers()).rejects.toMatchObject({ status: 500 });
  });
});

describe("carga por archivo", () => {
  it("manda FormData y NO fija Content-Type", async () => {
    // El navegador tiene que poner el boundary del multipart; fijarlo a mano
    // produce una peticion que el backend no puede parsear.
    fetchMock.mockResolvedValue(respuesta({ total: 1, counts: {}, rows: [] }));
    const file = new File(["correo\na@x.com\n"], "lista.csv", { type: "text/csv" });
    await previewMembersImport(file);
    const { url, opts } = ultimaLlamada();
    expect(url).toContain("/api/company-admin/import/preview/");
    expect(opts.body).toBeInstanceOf(FormData);
    expect(opts.body.get("file")).toBe(file);
    expect(opts.headers).not.toHaveProperty("Content-Type");
    expect(opts.headers.Authorization).toBe("Bearer tok-123");
  });

  it("confirmar usa la otra ruta", async () => {
    fetchMock.mockResolvedValue(respuesta({ total: 1, counts: {}, rows: [] }));
    await commitMembersImport(new File(["x"], "a.csv"));
    expect(ultimaLlamada().url).toMatch(/\/api\/company-admin\/import\/$/);
  });

  it("getImportTemplate devuelve el CSV como texto, no como JSON", async () => {
    fetchMock.mockResolvedValue(respuesta(null, { text: "correo,nombre,apellido\r\n" }));
    expect(await getImportTemplate()).toBe("correo,nombre,apellido\r\n");
  });
});

describe("propiedades que la revision encontro sin fijar", () => {
  // Las aserciones de ruta usan regex ANCLADA y no `toContain`: la URL de
  // reenviar contiene "/invitations/11/" como subcadena, asi que apuntar
  // cancelar a reenviar pasaba en verde (y daria un 405 real).
  it("las dos subidas de archivo usan POST", async () => {
    fetchMock.mockResolvedValue(respuesta({ total: 0, counts: {}, rows: [] }));
    const f = new File(["x"], "a.csv");
    await previewMembersImport(f);
    expect(ultimaLlamada().opts.method).toBe("POST");
    await commitMembersImport(f);
    expect(ultimaLlamada().opts.method).toBe("POST");
  });

  it("addCompanyMember usa POST, que es lo unico que lo distingue de listar", async () => {
    // members_view acepta GET y POST en la MISMA ruta.
    fetchMock.mockResolvedValue(respuesta({ invitation: {}, email_sent: true }));
    await addCompanyMember("a@x.com");
    expect(ultimaLlamada().opts.method).toBe("POST");
  });

  it("el metodo por omision de las peticiones autenticadas es GET", async () => {
    fetchMock.mockResolvedValue(respuesta({ members: [], invitations: [], total: 0 }));
    await getCompanyMembers();
    expect(ultimaLlamada().opts.method).toBe("GET");
  });

  it("la ruta del listado es exactamente la del backend", async () => {
    fetchMock.mockResolvedValue(respuesta({ members: [], invitations: [], total: 0 }));
    await getCompanyMembers();
    expect(ultimaLlamada().url).toMatch(/\/api\/company-admin\/members\/$/);
  });

  it("cancelar NO apunta a la ruta de reenviar", async () => {
    fetchMock.mockResolvedValue(respuesta({}));
    await cancelInvitation(11);
    expect(ultimaLlamada().url).toMatch(/\/api\/company-admin\/invitations\/11\/$/);
    await resendInvitation(11);
    expect(ultimaLlamada().url).toMatch(/\/invitations\/11\/resend\/$/);
  });

  it("editar NO apunta a desactivar ni a desvincular, y manda los campos", async () => {
    fetchMock.mockResolvedValue(respuesta({}));
    await updateCompanyMember(7, { usr_firstname: "Ana" });
    expect(ultimaLlamada().url).toMatch(/\/api\/company-admin\/members\/7\/$/);
    expect(JSON.parse(ultimaLlamada().opts.body)).toEqual({ usr_firstname: "Ana" });
  });

  it("la plantilla lanza en error, en vez de descargarse la pagina de error", async () => {
    // Sin el throw, T8 entregaria el cuerpo del 403 como plantilla_personal.csv.
    fetchMock.mockResolvedValue(respuesta({ detail: "No tiene permiso." },
      { ok: false, status: 403, text: '{"detail": "No tiene permiso."}' }));
    await expect(getImportTemplate()).rejects.toMatchObject({ status: 403 });
  });

  it("la plantilla manda el Bearer", async () => {
    fetchMock.mockResolvedValue(respuesta(null, { text: "correo,nombre,apellido" }));
    await getImportTemplate();
    expect(ultimaLlamada().opts.headers.Authorization).toBe("Bearer tok-123");
  });

  it("accept_policy viaja en FALSE cuando la persona no marco la casilla", async () => {
    // Es el unico dato con consecuencia legal que esta capa transmite, y nada
    // impedia fabricarlo en true.
    fetchMock.mockResolvedValue(respuesta({ access: "a", refresh: "r", user: {} }));
    await acceptInvitation("t", { password: "x", confirmPassword: "x", acceptPolicy: false });
    expect(JSON.parse(ultimaLlamada().opts.body).accept_policy).toBe(false);
  });

  it("los datos de personal no se sirven de cache", async () => {
    fetchMock.mockResolvedValue(respuesta({ members: [], invitations: [], total: 0 }));
    await getCompanyMembers();
    expect(ultimaLlamada().opts.cache).toBe("no-store");
    await previewMembersImport(new File(["x"], "a.csv"));
    expect(ultimaLlamada().opts.cache).toBe("no-store");
  });

  it("lee la CUARTA forma de error: los campos de DRF al tope del cuerpo", async () => {
    // Es lo que devuelve el 400 de aceptar, y sin esto la persona invitada
    // recibia un mensaje que no decia nada.
    fetchMock.mockResolvedValue(respuesta(
      { password: ["Ensure this field has at least 8 characters."] },
      { ok: false, status: 400 }));
    await expect(acceptInvitation("t", { password: "corto", confirmPassword: "corto", acceptPolicy: true }))
      .rejects.toMatchObject({
        status: 400,
        errors: { password: ["Ensure this field has at least 8 characters."] },
      });
  });

  it("el mensaje del Error NO lleva prosa inventada en ingles", async () => {
    // errorMessageFor usa el texto crudo como penultimo recurso, asi que una
    // frase puesta aqui se pintaba literalmente en una interfaz en espanol.
    fetchMock.mockResolvedValue(respuesta({}, { ok: false, status: 500 }));
    const err = await getCompanyMembers().catch((e) => e);
    expect(err.message).toBe("");
    expect(err.devMessage).toBeTruthy();   // el diagnostico queda, aparte
  });
});
