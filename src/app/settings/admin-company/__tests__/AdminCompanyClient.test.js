import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent, act } from "@testing-library/react";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

const isAuthenticated = vi.fn();
vi.mock("../../../../lib/session", () => ({
  isAuthenticated: (...a) => isAuthenticated(...a),
}));

const getCompanyMembers = vi.fn();
vi.mock("../../../../lib/api", () => ({
  getCompanyMembers: (...a) => getCompanyMembers(...a),
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
