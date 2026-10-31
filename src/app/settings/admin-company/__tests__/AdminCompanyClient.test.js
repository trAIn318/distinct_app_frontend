import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent, act } from "@testing-library/react";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

const isAuthenticated = vi.fn();
vi.mock("../../../../lib/session", () => ({
  isAuthenticated: (...a) => isAuthenticated(...a),
  // `lib/preferences` -de donde sale la lista de idiomas del formulario de
  // edicion- lo importa. Sin esta clave el modulo mockeado no provee el export
  // y la importacion revienta.
  getAccessToken: () => "token",
}));

// Las seis mutaciones de la Tarea 7 viven en el mismo modulo, asi que el mock
// tiene que proveerlas aunque esta tanda de pruebas no las ejercite: un export
// que falta en la factory revienta la importacion del componente. Lo que hacen
// se prueba en AdminCompanyActions.test.js.
const getCompanyMembers = vi.fn();
vi.mock("../../../../lib/api", () => ({
  getCompanyMembers: (...a) => getCompanyMembers(...a),
  addCompanyMember: vi.fn(),
  resendInvitation: vi.fn(),
  cancelInvitation: vi.fn(),
  updateCompanyMember: vi.fn(),
  deactivateCompanyMember: vi.fn(),
  unlinkCompanyMember: vi.fn(),
}));

import AdminCompanyClient from "../AdminCompanyClient";

// Sin I18nProvider, useT cae al ingles de en.json: todo se asserta en ingles.
const EMPEZAR = /no one on your team yet/i;
const REINTENTAR = /try again/i;

/** Un miembro del personal (rol 3): el backend acepta escrituras sobre el. */
function miembro(extra = {}) {
  return {
    id: 1,
    name: "jperez",
    email: "juan@hotel.com",
    firstname: "Juan",
    lastname: "Perez",
    rol_id: 3,
    active: true,
    confirmed: false,
    last_login: "2026-10-01T10:00:00Z",
    ...extra,
  };
}

function respuesta({ members = [], invitations = [], total } = {}) {
  return {
    members,
    invitations,
    total: total === undefined ? members.length : total,
  };
}

function conEstado(status) {
  return Object.assign(new Error(""), { status });
}

/** Filas de datos de la tabla (sin la de encabezados). */
function filas() {
  return screen.getAllByRole("row").slice(1);
}

beforeEach(() => {
  replace.mockClear();
  isAuthenticated.mockReset();
  getCompanyMembers.mockReset();
  isAuthenticated.mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("guard de pagina privada", () => {
  it("sin sesion redirige a login con ?next=/settings/admin-company", () => {
    isAuthenticated.mockReturnValue(false);
    render(<AdminCompanyClient />);
    expect(replace).toHaveBeenCalledWith("/login?next=/settings/admin-company");
    expect(getCompanyMembers).not.toHaveBeenCalled();
  });
});

describe("la tabla de su gente", () => {
  it("pinta una fila por persona, miembros e invitaciones en una sola lista", async () => {
    getCompanyMembers.mockResolvedValue(respuesta({
      members: [
        miembro(),
        miembro({ id: 2, name: "mlopez", email: "maria@hotel.com", firstname: "Maria", lastname: "Lopez" }),
      ],
      invitations: [{ id: 7, email: "nuevo@hotel.com", expired: false }],
      total: 2,
    }));
    render(<AdminCompanyClient />);
    await waitFor(() => expect(filas()).toHaveLength(3));
    expect(screen.getByText("Juan Perez")).toBeInTheDocument();
    expect(screen.getByText("Maria Lopez")).toBeInTheDocument();
    expect(screen.getByText("nuevo@hotel.com")).toBeInTheDocument();
  });

  it("cada fila lleva su estado EN TEXTO, no solo en color", async () => {
    getCompanyMembers.mockResolvedValue(respuesta({
      members: [
        miembro(),
        miembro({ id: 2, email: "b@hotel.com", firstname: "Ana", lastname: "Bravo", active: false }),
      ],
      invitations: [
        { id: 7, email: "c@hotel.com", expired: false },
        { id: 8, email: "d@hotel.com", expired: true },
      ],
      total: 2,
    }));
    render(<AdminCompanyClient />);
    await waitFor(() => expect(filas()).toHaveLength(4));
    for (const texto of ["Active", "Deactivated", "Invited", "Invitation expired"]) {
      expect(screen.getByText(texto)).toBeInTheDocument();
    }
    // Y el estado va dentro de la fila de su persona, no en una leyenda aparte.
    for (const fila of filas()) {
      expect(fila.textContent).toMatch(/Active|Deactivated|Invited|Invitation expired|Has not signed in/);
    }
  });

  it("'no ha ingresado' aparece para quien no tiene ultimo ingreso", async () => {
    getCompanyMembers.mockResolvedValue(respuesta({
      members: [miembro({ last_login: null })],
      total: 1,
    }));
    render(<AdminCompanyClient />);
    await waitFor(() => expect(screen.getByText(/has not signed in yet/i)).toBeInTheDocument());
    expect(screen.queryByText("Active")).not.toBeInTheDocument();
  });

  it("un miembro sin confirmar que ya entro sale como activo", async () => {
    // Medido en produccion: de 159 usuarios solo 13 estan confirmados, y los 50
    // que pertenecen a una empresa estan TODOS sin confirmar y usando el
    // sistema. Pintar su estado con `confirmed` ya costo dos defectos aqui.
    getCompanyMembers.mockResolvedValue(respuesta({
      members: [miembro({ confirmed: false, last_login: "2026-10-20T08:00:00Z" })],
      total: 1,
    }));
    render(<AdminCompanyClient />);
    await waitFor(() => expect(screen.getByText("Active")).toBeInTheDocument());
    expect(document.body.textContent).not.toMatch(/confirm/i);
  });

  it("la fila de una persona con nombre muestra TAMBIEN su correo", async () => {
    // El jefe busca por correo y tiene que poder ver cual es el de cada
    // persona; con solo el nombre, la busqueda por correo encuentra una fila
    // que no ensena lo que se busco.
    getCompanyMembers.mockResolvedValue(respuesta({ members: [miembro()], total: 1 }));
    render(<AdminCompanyClient />);
    await waitFor(() => expect(screen.getByText("Juan Perez")).toBeInTheDocument());
    const fila = filas()[0];
    expect(fila.textContent).toContain("juan@hotel.com");
  });

  it("una persona sin nombre ni apellido se identifica por su correo", async () => {
    getCompanyMembers.mockResolvedValue(respuesta({
      members: [miembro({ firstname: null, lastname: "" })],
      total: 1,
    }));
    render(<AdminCompanyClient />);
    await waitFor(() => expect(screen.getByText("juan@hotel.com")).toBeInTheDocument());
  });

  it("no usa vocabulario del modelo de datos en pantalla", async () => {
    getCompanyMembers.mockResolvedValue(respuesta({
      members: [miembro()],
      invitations: [{ id: 7, email: "nuevo@hotel.com", expired: false }],
      total: 1,
    }));
    render(<AdminCompanyClient />);
    await waitFor(() => expect(screen.getByText("Juan Perez")).toBeInTheDocument());
    expect(document.body.textContent).not.toMatch(/confirmed|placeholder|comp_id|\brole\b|\brol\b/i);
  });
});

describe("la busqueda, que es mixta porque el backend solo filtra a los miembros", () => {
  it("manda la busqueda al servidor", async () => {
    getCompanyMembers.mockResolvedValue(respuesta({ members: [miembro()], total: 1 }));
    render(<AdminCompanyClient />);
    await waitFor(() => expect(screen.getByText("Juan Perez")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/search by name or email/i), {
      target: { value: "maria" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^search$/i }));
    await waitFor(() => expect(getCompanyMembers).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: "maria" })));
  });

  it("y filtra en el navegador las invitaciones, que vuelven SIN filtrar", async () => {
    // El backend aplica ?q= solo a `members`. Sin el filtro del navegador, buscar
    // "juan" dejaba en pantalla a toda persona invitada de la empresa.
    getCompanyMembers.mockResolvedValue(respuesta({
      members: [miembro()],
      invitations: [{ id: 7, email: "otra.persona@hotel.com", expired: false }],
      total: 1,
    }));
    render(<AdminCompanyClient />);
    await waitFor(() => expect(filas()).toHaveLength(2));
    fireEvent.change(screen.getByLabelText(/search by name or email/i), {
      target: { value: "juan" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^search$/i }));
    // Las dos aserciones van JUNTAS dentro del waitFor a proposito: durante la
    // recarga no hay tabla, asi que "no esta" se cumpliria sin filtrar nada. La
    // condicion solo se satisface con la tabla pintada Y la invitacion fuera.
    await waitFor(() => {
      expect(screen.getByText("Juan Perez")).toBeInTheDocument();
      expect(screen.queryByText("otra.persona@hotel.com")).not.toBeInTheDocument();
      expect(filas()).toHaveLength(1);
    });
  });

  it("encuentra por el nombre de usuario, que el backend busca y la tabla no muestra", async () => {
    // El ?q= del backend busca en CUATRO columnas, `usr_name` incluida. Si el
    // filtro del navegador mira menos campos, esconde justo a quien el servidor
    // SI encontro: tabla vacia con el contador diciendo 1.
    getCompanyMembers.mockResolvedValue(respuesta({
      members: [miembro()],
      invitations: [{ id: 7, email: "otra.persona@hotel.com", expired: false }],
      total: 1,
    }));
    render(<AdminCompanyClient />);
    await waitFor(() => expect(filas()).toHaveLength(2));
    fireEvent.change(screen.getByLabelText(/search by name or email/i), {
      target: { value: "jperez" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^search$/i }));
    await waitFor(() => {
      expect(screen.getByText("Juan Perez")).toBeInTheDocument();
      expect(screen.queryByText("otra.persona@hotel.com")).not.toBeInTheDocument();
      expect(filas()).toHaveLength(1);
    });
  });

  it("una busqueda sin resultados NO invita a empezar: la empresa no esta vacia", async () => {
    getCompanyMembers
      .mockResolvedValueOnce(respuesta({ members: [miembro()], total: 1 }))
      .mockResolvedValueOnce(respuesta({ members: [], total: 0 }));
    render(<AdminCompanyClient />);
    await waitFor(() => expect(screen.getByText("Juan Perez")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/search by name or email/i), {
      target: { value: "nadie" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^search$/i }));
    await waitFor(() => expect(screen.getByText(/no one matches that search/i)).toBeInTheDocument());
    expect(screen.queryByText(EMPEZAR)).not.toBeInTheDocument();
  });
});

describe("paginacion", () => {
  function pagina(desde, cuantos, total) {
    return respuesta({
      members: Array.from({ length: cuantos }, (_, i) => miembro({
        id: desde + i,
        name: `u${desde + i}`,
        email: `p${desde + i}@hotel.com`,
        firstname: "P",
        lastname: String(desde + i),
      })),
      total,
    });
  }

  it("muestra el total y cuantas personas hay a la vista", async () => {
    getCompanyMembers.mockResolvedValue(pagina(1, 25, 30));
    render(<AdminCompanyClient />);
    await waitFor(() => expect(screen.getByText(/1.25 of 30/)).toBeInTheDocument());
  });

  it("avanza a la pagina siguiente pidiendo el offset correcto", async () => {
    getCompanyMembers
      .mockResolvedValueOnce(pagina(1, 25, 30))
      .mockResolvedValueOnce(pagina(26, 5, 30));
    render(<AdminCompanyClient />);
    await waitFor(() => expect(screen.getByRole("button", { name: /next/i })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => expect(getCompanyMembers).toHaveBeenLastCalledWith(
      expect.objectContaining({ offset: 25, limit: 25 })));
    await waitFor(() => expect(screen.getByText(/26.30 of 30/)).toBeInTheDocument());
  });

  it("en la ultima pagina no se puede avanzar, y en la primera no se puede volver", async () => {
    getCompanyMembers.mockResolvedValue(pagina(1, 4, 4));
    render(<AdminCompanyClient />);
    await waitFor(() => expect(screen.getByRole("button", { name: /next/i })).toBeDisabled());
    expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();
  });

  it("una busqueda nueva vuelve a la primera pagina", async () => {
    getCompanyMembers.mockResolvedValue(pagina(1, 25, 30));
    render(<AdminCompanyClient />);
    await waitFor(() => expect(screen.getByRole("button", { name: /next/i })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => expect(getCompanyMembers).toHaveBeenLastCalledWith(
      expect.objectContaining({ offset: 25 })));
    fireEvent.change(screen.getByLabelText(/search by name or email/i), {
      target: { value: "p2" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^search$/i }));
    await waitFor(() => expect(getCompanyMembers).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: "p2", offset: 0 })));
  });
});

describe("las tres situaciones que en pantalla se parecen", () => {
  it("si la carga FALLA no muestra el estado vacio: muestra error con reintentar", async () => {
    // Review Focus 1 del plan. Render free tarda hasta un minuto en despertar,
    // asi que esto pasa de verdad. Invitar a "empezar" cuando la carga fallo
    // manda al jefe a actuar sobre datos que nunca llegaron.
    getCompanyMembers.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<AdminCompanyClient />);
    await waitFor(() => expect(screen.getByRole("button", { name: REINTENTAR })).toBeInTheDocument());
    expect(screen.queryByText(EMPEZAR)).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("el error dice el motivo que dio el backend, no un generico", async () => {
    getCompanyMembers.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<AdminCompanyClient />);
    await waitFor(() => expect(screen.getByText(/could not reach the server/i)).toBeInTheDocument());
  });

  it("reintentar vuelve a pedir la lista y entra si el backend ya desperto", async () => {
    getCompanyMembers
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(respuesta({ members: [miembro()], total: 1 }));
    render(<AdminCompanyClient />);
    await waitFor(() => expect(screen.getByRole("button", { name: REINTENTAR })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: REINTENTAR }));
    await waitFor(() => expect(screen.getByText("Juan Perez")).toBeInTheDocument());
  });

  it("avisa que el servicio puede estar despertando cuando la carga tarda", async () => {
    vi.useFakeTimers();
    getCompanyMembers.mockReturnValue(new Promise(() => {}));
    render(<AdminCompanyClient />);
    // Antes del plazo dice "cargando": si el aviso saliera siempre, toda carga
    // normal acusaria al servicio de estar dormido.
    expect(screen.getByText(/loading your team/i)).toBeInTheDocument();
    expect(screen.queryByText(/waking up/i)).not.toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(4100);
    });
    expect(screen.getByText(/waking up/i)).toBeInTheDocument();
  });

  it("empresa vacia DE VERDAD: muestra la pantalla de empezar", async () => {
    getCompanyMembers.mockResolvedValue(respuesta({ members: [], invitations: [], total: 0 }));
    render(<AdminCompanyClient />);
    await waitFor(() => expect(screen.getByText(EMPEZAR)).toBeInTheDocument());
    // El diseno §6.3: campo de correo visible con su etiqueta, la opcion de
    // subir un archivo, y la linea que explica el correo para poner contrasena.
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /upload a file/i }))
      .toHaveAttribute("href", "/settings/admin-company/import");
    expect(screen.getByText(/email to set their own password/i)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: REINTENTAR })).not.toBeInTheDocument();
  });

  it("sin permiso (403): su propio estado, sin reintentar y sin invitar a empezar", async () => {
    getCompanyMembers.mockRejectedValue(conEstado(403));
    render(<AdminCompanyClient />);
    await waitFor(() => expect(screen.getByText(/do not have access to this page/i)).toBeInTheDocument());
    expect(screen.queryByText(EMPEZAR)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: REINTENTAR })).not.toBeInTheDocument();
  });

  it("administrador sin empresa (400): su propio estado, distinto del vacio", async () => {
    getCompanyMembers.mockRejectedValue(conEstado(400));
    render(<AdminCompanyClient />);
    await waitFor(() => expect(screen.getByText(/not linked to a company/i)).toBeInTheDocument());
    expect(screen.queryByText(EMPEZAR)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/email address/i)).not.toBeInTheDocument();
  });
});

describe("el lugar donde la Tarea 7 engancha las acciones", () => {
  it("la fila del personal lo lleva y la de un par administrador no", async () => {
    getCompanyMembers.mockResolvedValue(respuesta({
      members: [
        miembro({ id: 1, rol_id: 3 }),
        miembro({ id: 2, rol_id: 4, email: "jefa@hotel.com", firstname: "Ana", lastname: "Jefa" }),
      ],
      total: 2,
    }));
    render(<AdminCompanyClient />);
    await waitFor(() => expect(filas()).toHaveLength(2));
    expect(document.querySelector('[data-actions-for="member:1"]')).not.toBeNull();
    expect(document.querySelector('[data-actions-for="member:2"]')).toBeNull();
  });

  it("y la invitacion tambien lo lleva: reenviar y cancelar son suyas", async () => {
    getCompanyMembers.mockResolvedValue(respuesta({
      members: [],
      invitations: [{ id: 7, email: "nuevo@hotel.com", expired: false }],
      total: 0,
    }));
    render(<AdminCompanyClient />);
    await waitFor(() => expect(filas()).toHaveLength(1));
    expect(document.querySelector('[data-actions-for="invitation:7"]')).not.toBeNull();
  });
});

// ── Ronda de arreglos 1 ─────────────────────────────────────────────────────

/** `cuantos` miembros consecutivos, para armar paginas de 25. */
function personas(desde, cuantos) {
  return Array.from({ length: cuantos }, (_, i) => miembro({
    id: desde + i,
    name: `u${desde + i}`,
    email: `p${String(desde + i).padStart(3, "0")}@hotel.com`,
    firstname: "P",
    lastname: String(desde + i).padStart(3, "0"),
  }));
}

/** El primer argumento de la ultima llamada al backend. */
function ultimaPeticion() {
  return getCompanyMembers.mock.calls.at(-1)[0];
}

describe("C1 — toda accion de la persona garantiza una peticion nueva", () => {
  // `empezarCarga` fija fase=CARGANDO, pero el fetch lo dispara un efecto con
  // dependencias [ready, q, offset, intento]. Si la consulta no cambia, el
  // efecto no vuelve a correr y nadie saca a la pantalla de CARGANDO, cuya
  // vista es un solo <p role="status">: sin buscador, sin paginador, sin boton.
  // La unica salida es recargar.

  it("Buscar con el campo vacio desde la tabla ya cargada no congela la pantalla", async () => {
    getCompanyMembers.mockResolvedValue(respuesta({ members: [miembro()], total: 1 }));
    render(<AdminCompanyClient />);
    await waitFor(() => expect(screen.getByText("Juan Perez")).toBeInTheDocument());
    const antes = getCompanyMembers.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: /^search$/i }));
    await waitFor(() => {
      expect(getCompanyMembers.mock.calls.length).toBe(antes + 1);
      expect(screen.getByRole("table")).toBeInTheDocument();
    });
  });

  it("Buscar dos veces con el mismo texto deja la tabla a la vista", async () => {
    // El campo es type=search dentro de un form, asi que pulsar Enter dos veces
    // —habito universal— produce exactamente esto.
    getCompanyMembers.mockResolvedValue(respuesta({ members: [miembro()], total: 1 }));
    render(<AdminCompanyClient />);
    await waitFor(() => expect(screen.getByText("Juan Perez")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/search by name or email/i), {
      target: { value: "juan" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^search$/i }));
    await waitFor(() => {
      expect(getCompanyMembers).toHaveBeenLastCalledWith(expect.objectContaining({ q: "juan" }));
      expect(screen.getByRole("table")).toBeInTheDocument();
    });
    const antes = getCompanyMembers.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: /^search$/i }));
    await waitFor(() => {
      expect(getCompanyMembers.mock.calls.length).toBe(antes + 1);
      expect(screen.getByRole("table")).toBeInTheDocument();
    });
  });

  it("Buscar con solo espacios tampoco deja la pantalla sin salida", async () => {
    getCompanyMembers.mockResolvedValue(respuesta({ members: [miembro()], total: 1 }));
    render(<AdminCompanyClient />);
    await waitFor(() => expect(screen.getByText("Juan Perez")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/search by name or email/i), {
      target: { value: "   " },
    });
    const antes = getCompanyMembers.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: /^search$/i }));
    await waitFor(() => {
      expect(getCompanyMembers.mock.calls.length).toBe(antes + 1);
      expect(screen.getByRole("table")).toBeInTheDocument();
    });
    // Y el texto en blanco no se manda como busqueda.
    expect(ultimaPeticion()).toEqual({ limit: 25, offset: 0 });
  });
});

describe("C2+C3 — lo que la pagina pinta y lo que el contador cuenta", () => {
  // Medido en el backend (company_admin_views.py:166-173): `total = qs.count()`
  // cuenta SOLO miembros, e `invitations` vuelve COMPLETO en cada respuesta,
  // sin offset ni limit.

  it("0 miembros y 2 invitaciones: el contador no dice 0 de 0 delante de dos filas", async () => {
    getCompanyMembers.mockResolvedValue(respuesta({
      members: [],
      invitations: [
        { id: 7, email: "uno@hotel.com", expired: false },
        { id: 8, email: "dos@hotel.com", expired: false },
      ],
      total: 0,
    }));
    render(<AdminCompanyClient />);
    await waitFor(() => expect(filas()).toHaveLength(2));
    expect(screen.getByText(/no team members yet/i)).toBeInTheDocument();
    expect(screen.queryByText(/0.0 of 0/)).not.toBeInTheDocument();
  });

  it("la persona invitada aparece UNA sola vez en todo el listado", async () => {
    // Con las acciones de la Tarea 7 encima, repetirla por pagina daria DOS
    // elementos con el mismo data-actions-for.
    const inv = { id: 7, email: "zz.invitada@hotel.com", expired: false };
    getCompanyMembers
      .mockResolvedValueOnce(respuesta({ members: personas(1, 25), invitations: [inv], total: 32 }))
      .mockResolvedValueOnce(respuesta({ members: personas(26, 7), invitations: [inv], total: 32 }));
    render(<AdminCompanyClient />);
    await waitFor(() => expect(filas()).toHaveLength(26));
    expect(screen.getByText("zz.invitada@hotel.com")).toBeInTheDocument();
    // La nota es verdad en la pagina 1...
    expect(screen.getByText(/first page only/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => expect(filas()).toHaveLength(7));
    expect(screen.queryByText("zz.invitada@hotel.com")).not.toBeInTheDocument();
    // ...y es justo en la pagina 2 donde hace falta, donde el roster ya no las
    // tiene. Por eso la condicion mira lo que DEVOLVIO el backend.
    expect(screen.getByText(/first page only/i)).toBeInTheDocument();
  });

  it("m3: la nota de pendientes NO sale cuando todo cabe en una pagina", async () => {
    getCompanyMembers.mockResolvedValue(respuesta({
      members: [miembro()],
      invitations: [{ id: 7, email: "zoe@hotel.com", expired: false }],
      total: 1,
    }));
    render(<AdminCompanyClient />);
    await waitFor(() => expect(filas()).toHaveLength(2));
    expect(screen.queryByText(/first page/i)).not.toBeInTheDocument();
  });

  it("m4: el contador cuenta MIEMBROS y lo dice, no cuenta las filas que se ven", async () => {
    getCompanyMembers.mockResolvedValue(respuesta({
      members: [miembro()],
      invitations: [
        { id: 7, email: "a.invitada@hotel.com", expired: false },
        { id: 8, email: "b.invitada@hotel.com", expired: false },
      ],
      total: 1,
    }));
    render(<AdminCompanyClient />);
    await waitFor(() => expect(filas()).toHaveLength(3));
    expect(screen.getByText(/showing 1.1 of 1 team members/i)).toBeInTheDocument();
    expect(screen.queryByText(/of 3/)).not.toBeInTheDocument();
  });

  it("buscar el correo de una persona invitada la encuentra", async () => {
    const inv = { id: 7, email: "zoe@hotel.com", expired: false };
    getCompanyMembers
      .mockResolvedValueOnce(respuesta({ members: [miembro()], invitations: [inv], total: 1 }))
      .mockResolvedValue(respuesta({ members: [], invitations: [inv], total: 0 }));
    render(<AdminCompanyClient />);
    await waitFor(() => expect(filas()).toHaveLength(2));
    fireEvent.change(screen.getByLabelText(/search by name or email/i), {
      target: { value: "zoe@hotel.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^search$/i }));
    await waitFor(() => {
      expect(screen.getByText("zoe@hotel.com")).toBeInTheDocument();
      expect(filas()).toHaveLength(1);
    });
  });
});

describe("I1 — una pagina que vuelve vacia", () => {
  it("no se presenta como empresa vacia, y tiene camino de vuelta", async () => {
    // Alguien desvinculo a 5 personas entre las dos peticiones.
    getCompanyMembers
      .mockResolvedValueOnce(respuesta({ members: personas(1, 25), total: 30 }))
      .mockResolvedValueOnce(respuesta({ members: [], invitations: [], total: 30 }))
      .mockResolvedValue(respuesta({ members: personas(1, 25), total: 25 }));
    render(<AdminCompanyClient />);
    await waitFor(() => expect(screen.getByRole("button", { name: /next/i })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => expect(screen.getByText(/this page no longer has anyone/i)).toBeInTheDocument());
    expect(screen.queryByText(EMPEZAR)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /go to the first page/i }));
    await waitFor(() => expect(ultimaPeticion().offset).toBe(0));
  });
});

describe("I2 — un 200 cuyo cuerpo no tiene la forma esperada", () => {
  // `_cuerpo()` en api.js devuelve {} ante cualquier cuerpo que no sea JSON: un
  // 200 del proxy con HTML dentro llega asi. La prueba del fallo usa un
  // RECHAZO, asi que no cubre esta puerta, la del EXITO.
  for (const [nombre, cuerpo] of [["{}", {}], ["null", null]]) {
    it(`resolver ${nombre} es un fallo con reintentar, no una empresa vacia`, async () => {
      getCompanyMembers.mockResolvedValue(cuerpo);
      render(<AdminCompanyClient />);
      await waitFor(() => expect(screen.getByRole("button", { name: REINTENTAR })).toBeInTheDocument());
      expect(screen.queryByText(EMPEZAR)).not.toBeInTheDocument();
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });
  }
});

describe("I3 e I4 — los dos errores que pintaban ingles del framework", () => {
  it("I3: la sesion vencida (401) tiene su propio estado, con ir a iniciar sesion", async () => {
    // `isAuthenticated()` solo comprueba que EXISTA un token, no que sirva.
    getCompanyMembers.mockRejectedValue(Object.assign(
      new Error("Given token not valid for any token type"),
      { status: 401 },
    ));
    render(<AdminCompanyClient />);
    await waitFor(() => expect(screen.getByText(/your session ended/i)).toBeInTheDocument());
    expect(document.body.textContent).not.toMatch(/token not valid/i);
    // Reintentar es la unica accion que NO puede funcionar con un token vencido.
    expect(screen.queryByRole("button", { name: REINTENTAR })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
    expect(replace).toHaveBeenCalledWith("/login?next=/settings/admin-company");
  });

  it("I4: un 429 del throttle no pinta la prosa inglesa del framework", async () => {
    getCompanyMembers.mockRejectedValue(Object.assign(
      new Error("Request was throttled. Expected available in 42 seconds."),
      { status: 429 },
    ));
    render(<AdminCompanyClient />);
    await waitFor(() => expect(screen.getByText(/too many requests/i)).toBeInTheDocument());
    expect(document.body.textContent).not.toMatch(/throttled/i);
  });
});

describe("I5 — una busqueda que falla no es un callejon sin salida", () => {
  it("ofrece volver al listado completo, y lo pide SIN q", async () => {
    // `reintentar` conserva `q`, asi que repite LA BUSQUEDA: sin este control no
    // queda forma de volver al listado completo.
    getCompanyMembers
      .mockResolvedValueOnce(respuesta({ members: [miembro()], total: 1 }))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValue(respuesta({ members: [miembro()], total: 1 }));
    render(<AdminCompanyClient />);
    await waitFor(() => expect(screen.getByText("Juan Perez")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/search by name or email/i), {
      target: { value: "nadie" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^search$/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: REINTENTAR })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /show everyone again/i }));
    await waitFor(() => {
      expect(ultimaPeticion()).not.toHaveProperty("q");
      expect(ultimaPeticion().offset).toBe(0);
      expect(screen.getByText("Juan Perez")).toBeInTheDocument();
    });
  });
});

describe("los controles de la pantalla que ninguna prueba sostenia", () => {
  it("m1: con un total multiplo de la pagina, la ultima pagina no deja avanzar", async () => {
    // El borde exacto: total 50, offset 25. Con `<=` en vez de `<` habria una
    // pagina 3 que vuelve vacia.
    getCompanyMembers
      .mockResolvedValueOnce(respuesta({ members: personas(1, 25), total: 50 }))
      .mockResolvedValueOnce(respuesta({ members: personas(26, 25), total: 50 }));
    render(<AdminCompanyClient />);
    await waitFor(() => expect(screen.getByRole("button", { name: /next/i })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => expect(screen.getByText(/26.50 of 50/)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /previous/i })).toBeEnabled();
  });

  it("m2: Limpiar vuelve al listado completo y vacia el campo", async () => {
    getCompanyMembers
      .mockResolvedValueOnce(respuesta({ members: [miembro()], total: 1 }))
      .mockResolvedValueOnce(respuesta({ members: [miembro()], total: 1 }))
      .mockResolvedValue(respuesta({
        members: [
          miembro(),
          miembro({ id: 2, name: "abravo", email: "ana@hotel.com", firstname: "Ana", lastname: "Bravo" }),
        ],
        total: 2,
      }));
    render(<AdminCompanyClient />);
    await waitFor(() => expect(screen.getByText("Juan Perez")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/search by name or email/i), {
      target: { value: "juan" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^search$/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /^clear$/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /^clear$/i }));
    await waitFor(() => {
      expect(ultimaPeticion()).not.toHaveProperty("q");
      expect(ultimaPeticion().offset).toBe(0);
      expect(screen.getByText("Ana Bravo")).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/search by name or email/i)).toHaveValue("");
    expect(screen.queryByRole("button", { name: /^clear$/i })).not.toBeInTheDocument();
  });

  it("m2: Anterior retrocede una pagina, no avanza", async () => {
    getCompanyMembers
      .mockResolvedValueOnce(respuesta({ members: personas(1, 25), total: 60 }))
      .mockResolvedValueOnce(respuesta({ members: personas(26, 25), total: 60 }))
      .mockResolvedValue(respuesta({ members: personas(1, 25), total: 60 }));
    render(<AdminCompanyClient />);
    await waitFor(() => expect(screen.getByRole("button", { name: /next/i })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => expect(screen.getByText(/26.50 of 60/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /previous/i }));
    await waitFor(() => expect(ultimaPeticion().offset).toBe(0));
    await waitFor(() => expect(screen.getByText(/1.25 of 60/)).toBeInTheDocument());
  });

  it("M51: Limpiar desde la pagina 2 de una busqueda vuelve a la PRIMERA pagina", async () => {
    // Asimetrico: la misma linea de `buscar` si estaba sostenida ("una busqueda
    // nueva vuelve a la primera pagina") y la de `limpiar` no, porque la prueba
    // de Limpiar se hacia desde la pagina 1, donde el offset ya era 0. Limpiar
    // desde la pagina 2 de una busqueda caia en la vista de "pagina fuera de
    // rango" en cuanto el listado completo tuviera menos de 26 personas.
    getCompanyMembers
      .mockResolvedValueOnce(respuesta({ members: personas(1, 25), total: 60 }))
      .mockResolvedValueOnce(respuesta({ members: personas(1, 25), total: 60 }))
      .mockResolvedValueOnce(respuesta({ members: personas(26, 25), total: 60 }))
      .mockResolvedValue(respuesta({ members: personas(1, 25), total: 60 }));
    render(<AdminCompanyClient />);
    await waitFor(() => expect(screen.getByRole("button", { name: /next/i })).toBeEnabled());
    fireEvent.change(screen.getByLabelText(/search by name or email/i), {
      target: { value: "p0" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^search$/i }));
    await waitFor(() => expect(ultimaPeticion()).toEqual({ q: "p0", limit: 25, offset: 0 }));
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => expect(ultimaPeticion()).toEqual({ q: "p0", limit: 25, offset: 25 }));
    fireEvent.click(screen.getByRole("button", { name: /^clear$/i }));
    await waitFor(() => {
      expect(ultimaPeticion()).not.toHaveProperty("q");
      expect(ultimaPeticion().offset).toBe(0);
    });
    // Y se queda en la tabla, no en la vista de pagina fuera de rango.
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("m6: el campo de correo del estado vacio es obligatorio, con indicador visible", async () => {
    getCompanyMembers.mockResolvedValue(respuesta({ members: [], invitations: [], total: 0 }));
    render(<AdminCompanyClient />);
    await waitFor(() => expect(screen.getByText(EMPEZAR)).toBeInTheDocument());
    expect(screen.getByLabelText(/email address/i)).toBeRequired();
    const etiqueta = document.querySelector('label[for="invite-email"]');
    const visible = [...etiqueta.querySelectorAll("span")]
      .filter((s) => !String(s.className).includes("sr-only"));
    expect(visible.some((s) => s.textContent.includes("*"))).toBe(true);
    // Y el indicador visible tiene su equivalente para lector de pantalla.
    expect(etiqueta.textContent).toMatch(/required/i);
  });
});

// ── C2: la carga por archivo tiene que ser alcanzable ───────────────────────

describe("C2 — la carga por archivo se alcanza con la empresa ya poblada", () => {
  // El unico enlace a /settings/admin-company/import vivia dentro del estado
  // vacio, que exige `roster.length === 0 && !q && offset === 0`: la primera
  // invitacion lo hacia desaparecer y no volvia nunca, y el menu solo enruta
  // `settings/admin-company`. O sea que no habia segundo camino: la pantalla de
  // carga era inalcanzable en produccion en cuanto la empresa tenia a alguien.

  const ENLACE = { name: /upload a file/i };

  it("el enlace esta en la vista de la TABLA, no solo en el estado vacio", async () => {
    getCompanyMembers.mockResolvedValue(respuesta({ members: [miembro()], total: 1 }));
    render(<AdminCompanyClient />);
    await waitFor(() => expect(screen.getByRole("table")).toBeInTheDocument());
    // Y no hay estado vacio a la vista: el enlace sale de la tabla.
    expect(screen.queryByText(EMPEZAR)).not.toBeInTheDocument();
    expect(screen.getByRole("link", ENLACE))
      .toHaveAttribute("href", "/settings/admin-company/import");
  });

  it("y tambien con una busqueda puesta y en la pagina 2", async () => {
    // Los dos estados en los que el jefe pasa el dia: buscando, y paginando.
    getCompanyMembers
      .mockResolvedValueOnce(respuesta({ members: personas(1, 25), total: 60 }))
      .mockResolvedValue(respuesta({ members: personas(26, 25), total: 60 }));
    render(<AdminCompanyClient />);
    await waitFor(() => expect(screen.getByRole("button", { name: /next/i })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => expect(ultimaPeticion().offset).toBe(25));
    expect(screen.getByRole("link", ENLACE)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/search by name or email/i), {
      target: { value: "p0" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^search$/i }));
    await waitFor(() => expect(ultimaPeticion().q).toBe("p0"));
    expect(screen.getByRole("link", ENLACE)).toBeInTheDocument();
  });

  it("y sigue siendo UNO solo, no dos caminos pintados a la vez", async () => {
    // El estado vacio tiene el suyo; la tabla, el suyo. Nunca los dos.
    getCompanyMembers.mockResolvedValue(respuesta({ members: [], invitations: [], total: 0 }));
    render(<AdminCompanyClient />);
    await waitFor(() => expect(screen.getByText(EMPEZAR)).toBeInTheDocument());
    expect(screen.getAllByRole("link", ENLACE)).toHaveLength(1);
  });
});

describe("claude.md 2.1 — como maximo UN dorado por vista, en todos los estados", () => {
  // `.btn-primary` es el unico relleno dorado del repositorio, asi que se
  // cuenta. Los estados de error y el de un dialogo abierto incluidos: son
  // justo los que crecen cuando se le agrega un control a una vista.
  const dorados = () => document.querySelectorAll(".btn-primary").length;

  it("la tabla, con un dialogo abierto encima", async () => {
    getCompanyMembers.mockResolvedValue(respuesta({ members: [miembro()], total: 1 }));
    render(<AdminCompanyClient />);
    await waitFor(() => expect(screen.getByRole("table")).toBeInTheDocument());
    expect(dorados(), "la tabla").toBe(1);
    fireEvent.click(screen.getByRole("button", { name: /^edit juan perez$/i }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    expect(dorados(), "la tabla con el dialogo abierto").toBe(1);
  });

  it("el estado vacio, la pagina fuera de rango y los cuatro estados de error", async () => {
    const casos = [
      ["estado vacio", respuesta({ members: [], invitations: [], total: 0 }), null, EMPEZAR, 1],
      ["fallo de carga", null, new TypeError("Failed to fetch"), /could not load your team/i, 0],
      ["403", null, conEstado(403), /do not have access/i, 0],
      ["400", null, conEstado(400), /not linked to a company/i, 0],
      ["401", null, conEstado(401), /your session ended/i, 1],
    ];
    for (const [nombre, cuerpo, fallo, texto, esperado] of casos) {
      getCompanyMembers.mockReset();
      if (fallo) getCompanyMembers.mockRejectedValue(fallo);
      else getCompanyMembers.mockResolvedValue(cuerpo);
      const { unmount } = render(<AdminCompanyClient />);
      await waitFor(() => expect(screen.getByText(texto)).toBeInTheDocument());
      expect(dorados(), nombre).toBe(esperado);
      unmount();
    }
  });

  it("la pagina fuera de rango", async () => {
    getCompanyMembers
      .mockResolvedValueOnce(respuesta({ members: personas(1, 25), total: 30 }))
      .mockResolvedValue(respuesta({ members: [], invitations: [], total: 30 }));
    render(<AdminCompanyClient />);
    await waitFor(() => expect(screen.getByRole("button", { name: /next/i })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => expect(screen.getByText(/this page no longer has anyone/i)).toBeInTheDocument());
    expect(dorados()).toBe(0);
  });
});
