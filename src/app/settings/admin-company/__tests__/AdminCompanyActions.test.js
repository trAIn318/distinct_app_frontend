import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

const isAuthenticated = vi.fn();
vi.mock("../../../../lib/session", () => ({
  isAuthenticated: (...a) => isAuthenticated(...a),
  // `lib/preferences` -de donde sale la lista de idiomas- lo importa. Sin esta
  // clave el modulo mockeado no provee el export y la importacion revienta.
  getAccessToken: () => "token",
}));

const getCompanyMembers = vi.fn();
const addCompanyMember = vi.fn();
const resendInvitation = vi.fn();
const cancelInvitation = vi.fn();
const updateCompanyMember = vi.fn();
const deactivateCompanyMember = vi.fn();
const unlinkCompanyMember = vi.fn();
vi.mock("../../../../lib/api", () => ({
  getCompanyMembers: (...a) => getCompanyMembers(...a),
  addCompanyMember: (...a) => addCompanyMember(...a),
  resendInvitation: (...a) => resendInvitation(...a),
  cancelInvitation: (...a) => cancelInvitation(...a),
  updateCompanyMember: (...a) => updateCompanyMember(...a),
  deactivateCompanyMember: (...a) => deactivateCompanyMember(...a),
  unlinkCompanyMember: (...a) => unlinkCompanyMember(...a),
}));

import AdminCompanyClient from "../AdminCompanyClient";

// Sin I18nProvider, `useT` cae al ingles de en.json: TODA asercion de texto va
// contra el ingles.

/** Un miembro del personal (rol 3): el backend acepta escrituras sobre el. */
function miembro(extra = {}) {
  return {
    id: 1,
    name: "jperez",
    email: "juan@hotel.com",
    firstname: "Juan",
    lastname: "Perez",
    phone: "3001112233",
    lang_code: "es",
    rol_id: 3,
    active: true,
    confirmed: false,
    last_login: "2026-10-01T10:00:00Z",
    ...extra,
  };
}

/** Una invitacion pendiente, con vigencia por omision dentro de las 72 h. */
function invitacion(extra = {}) {
  return {
    id: 7,
    email: "nuevo@hotel.com",
    kind: "new",
    status: "pending",
    expired: false,
    expires_at: new Date(Date.now() + 54 * 3600 * 1000).toISOString(),
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

/** Filas de datos de la tabla (sin la de encabezados). */
function filas() {
  return screen.getAllByRole("row").slice(1);
}

/** Espera a que la tabla este pintada con `n` filas de datos. */
async function tablaCon(n) {
  await waitFor(() => expect(filas()).toHaveLength(n));
}

const CAMPO_CORREO = /email address/i;
const BOTON_INVITAR = { name: /^send invitation$/i };

/** Una promesa que se resuelve cuando se le dice. */
function diferida() {
  let resolver;
  const promesa = new Promise((res) => { resolver = res; });
  return { promesa, resolver };
}

beforeEach(() => {
  replace.mockClear();
  for (const m of [
    isAuthenticated, getCompanyMembers, addCompanyMember, resendInvitation,
    cancelInvitation, updateCompanyMember, deactivateCompanyMember, unlinkCompanyMember,
  ]) m.mockReset();
  isAuthenticated.mockReturnValue(true);
  addCompanyMember.mockResolvedValue({ invitation: invitacion({ id: 55 }), email_sent: true });
  resendInvitation.mockResolvedValue({ invitation: invitacion(), email_sent: true });
  cancelInvitation.mockResolvedValue({ detail: "Invitación cancelada." });
  updateCompanyMember.mockResolvedValue({ member: miembro() });
  deactivateCompanyMember.mockResolvedValue({ member: miembro({ active: false }) });
  unlinkCompanyMember.mockResolvedValue({ member: miembro({ comp_id: null }) });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("invitar por correo", () => {
  it("manda el correo, recarga la lista y la persona aparece", async () => {
    getCompanyMembers
      .mockResolvedValueOnce(respuesta({ members: [], invitations: [], total: 0 }))
      .mockResolvedValue(respuesta({
        members: [], invitations: [invitacion({ id: 55, email: "nuevo@hotel.com" })], total: 0,
      }));
    render(<AdminCompanyClient />);
    await waitFor(() => expect(screen.getByLabelText(CAMPO_CORREO)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(CAMPO_CORREO), {
      target: { value: "nuevo@hotel.com" },
    });
    fireEvent.click(screen.getByRole("button", BOTON_INVITAR));
    await waitFor(() => expect(addCompanyMember).toHaveBeenCalledWith("nuevo@hotel.com"));
    // La recarga: la segunda peticion al listado Y la fila nueva en pantalla.
    await waitFor(() => {
      expect(getCompanyMembers.mock.calls.length).toBeGreaterThan(1);
      expect(screen.getByText("nuevo@hotel.com")).toBeInTheDocument();
    });
    expect(screen.getByText(/invitation sent to nuevo@hotel.com/i)).toBeInTheDocument();
  });

  it("tambien se invita desde la tabla, no solo desde el estado vacio", async () => {
    getCompanyMembers.mockResolvedValue(respuesta({ members: [miembro()], total: 1 }));
    render(<AdminCompanyClient />);
    await tablaCon(1);
    fireEvent.change(screen.getByLabelText(CAMPO_CORREO), {
      target: { value: "otra@hotel.com" },
    });
    fireEvent.click(screen.getByRole("button", BOTON_INVITAR));
    await waitFor(() => expect(addCompanyMember).toHaveBeenCalledWith("otra@hotel.com"));
  });

  it("si el correo NO salio lo dice sin pintar un error, y ofrece reenviar", async () => {
    // Render bloquea SMTP y el envio va por Resend: `email_sent: false` es un
    // escenario real. La invitacion SI se creo, asi que un error rojo haria
    // pensar que no se invito a nadie.
    addCompanyMember.mockResolvedValue({
      invitation: invitacion({ id: 55, email: "nuevo@hotel.com" }),
      email_sent: false,
    });
    getCompanyMembers.mockResolvedValue(respuesta({ members: [], invitations: [], total: 0 }));
    render(<AdminCompanyClient />);
    await waitFor(() => expect(screen.getByLabelText(CAMPO_CORREO)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(CAMPO_CORREO), {
      target: { value: "nuevo@hotel.com" },
    });
    fireEvent.click(screen.getByRole("button", BOTON_INVITAR));
    await waitFor(() => expect(
      screen.getByText(/could not send the email to nuevo@hotel.com/i),
    ).toBeInTheDocument());
    // Dicho como aviso, no como error.
    expect(screen.getByText(/could not send the email to nuevo@hotel.com/i))
      .toHaveAttribute("role", "status");
    // Y la salida ofrecida es reenviar esa misma invitacion.
    fireEvent.click(screen.getByRole("button", { name: /^resend$/i }));
    await waitFor(() => expect(resendInvitation).toHaveBeenCalledWith(55));
  });

  it("doble envio del formulario invita UNA sola vez", async () => {
    // Review Focus 4. Se prueba con `fireEvent.submit`, que IGNORA `disabled`:
    // asi la prueba mide el guard de verdad y no el atributo.
    const { promesa, resolver } = diferida();
    addCompanyMember.mockReturnValue(promesa);
    getCompanyMembers.mockResolvedValue(respuesta({ members: [], invitations: [], total: 0 }));
    render(<AdminCompanyClient />);
    await waitFor(() => expect(screen.getByLabelText(CAMPO_CORREO)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(CAMPO_CORREO), {
      target: { value: "nuevo@hotel.com" },
    });
    const formulario = screen.getByRole("button", BOTON_INVITAR).closest("form");
    fireEvent.submit(formulario);
    fireEvent.submit(formulario);
    expect(addCompanyMember).toHaveBeenCalledTimes(1);
    resolver({ invitation: invitacion({ id: 55 }), email_sent: true });
    await waitFor(() => expect(getCompanyMembers.mock.calls.length).toBeGreaterThan(1));
    expect(addCompanyMember).toHaveBeenCalledTimes(1);
  });

  it("y el boton queda deshabilitado mientras la invitacion esta en vuelo", async () => {
    // El OTRO mecanismo, fijado por separado: en la Tarea 5 las dos mutaciones
    // -quitar el guard, quitar el `disabled`- sobrevivian cada una sin que la
    // prueba dijera cual seguia viva.
    const { promesa, resolver } = diferida();
    addCompanyMember.mockReturnValue(promesa);
    getCompanyMembers.mockResolvedValue(respuesta({ members: [], invitations: [], total: 0 }));
    render(<AdminCompanyClient />);
    await waitFor(() => expect(screen.getByLabelText(CAMPO_CORREO)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(CAMPO_CORREO), {
      target: { value: "nuevo@hotel.com" },
    });
    expect(screen.getByRole("button", BOTON_INVITAR)).toBeEnabled();
    fireEvent.click(screen.getByRole("button", BOTON_INVITAR));
    await waitFor(() => expect(screen.getByRole("button", BOTON_INVITAR)).toBeDisabled());
    resolver({ invitation: invitacion({ id: 55 }), email_sent: true });
    await waitFor(() => expect(screen.getByRole("button", BOTON_INVITAR)).toBeEnabled());
  });

  it("un 409 de 'ya es miembro' se muestra traducido, no en el idioma del backend", async () => {
    addCompanyMember.mockRejectedValue(Object.assign(
      new Error("Esta persona ya es miembro o ya tiene una invitación vigente."),
      { status: 409 },
    ));
    getCompanyMembers.mockResolvedValue(respuesta({ members: [miembro()], total: 1 }));
    render(<AdminCompanyClient />);
    await tablaCon(1);
    fireEvent.change(screen.getByLabelText(CAMPO_CORREO), {
      target: { value: "juan@hotel.com" },
    });
    fireEvent.click(screen.getByRole("button", BOTON_INVITAR));
    await waitFor(() => expect(
      screen.getByText(/already on your team, or already has a pending invitation/i),
    ).toBeInTheDocument());
    expect(document.body.textContent).not.toMatch(/ya es miembro|vigente/i);
    // Y no se recarga la lista por un fallo.
    expect(getCompanyMembers).toHaveBeenCalledTimes(1);
  });

  it("no llama al backend con el campo vacio: lo dice debajo del campo", async () => {
    getCompanyMembers.mockResolvedValue(respuesta({ members: [miembro()], total: 1 }));
    render(<AdminCompanyClient />);
    await tablaCon(1);
    fireEvent.submit(screen.getByRole("button", BOTON_INVITAR).closest("form"));
    await waitFor(() => expect(screen.getByText(/enter an email address/i)).toBeInTheDocument());
    expect(addCompanyMember).not.toHaveBeenCalled();
    // claude.md: el error va DEBAJO del campo y el campo queda marcado como
    // invalido, no en un alert() ni en una franja suelta.
    const campo = screen.getByLabelText(CAMPO_CORREO);
    expect(campo).toHaveAttribute("aria-invalid", "true");
    const idDelError = campo.getAttribute("aria-describedby");
    expect(document.getElementById(idDelError).textContent)
      .toMatch(/enter an email address/i);
  });
});

describe("reenviar y cancelar, sobre la invitacion CORRECTA", () => {
  // Con una sola invitacion montada la prueba no puede distinguir si la accion
  // actuo sobre la fila correcta: van DOS.
  function dos() {
    return respuesta({
      members: [],
      invitations: [
        invitacion({ id: 7, email: "aaa@hotel.com" }),
        invitacion({ id: 8, email: "bbb@hotel.com" }),
      ],
      total: 0,
    });
  }

  it("reenviar actua sobre la invitacion de SU fila", async () => {
    getCompanyMembers.mockResolvedValue(dos());
    render(<AdminCompanyClient />);
    await tablaCon(2);
    fireEvent.click(screen.getByRole("button", {
      name: /resend the invitation to bbb@hotel\.com/i,
    }));
    await waitFor(() => expect(resendInvitation).toHaveBeenCalledWith(8));
    expect(resendInvitation).toHaveBeenCalledTimes(1);
    // Y recarga la lista al terminar.
    await waitFor(() => expect(getCompanyMembers.mock.calls.length).toBeGreaterThan(1));
    expect(screen.getByText(/invitation sent again to bbb@hotel.com/i)).toBeInTheDocument();
  });

  it("cancelar actua sobre la invitacion de SU fila", async () => {
    // Sobre la SEGUNDA, no la primera: apuntar a la primera fila del listado es
    // justo la mutacion que esta prueba tiene que matar, y con la primera
    // seleccionada el resultado es identico y la prueba no puede distinguir.
    // Verificado por mutacion: con `roster[0].id` esta prueba se pone roja.
    getCompanyMembers.mockResolvedValue(dos());
    render(<AdminCompanyClient />);
    await tablaCon(2);
    fireEvent.click(screen.getByRole("button", {
      name: /cancel the invitation to bbb@hotel\.com/i,
    }));
    await waitFor(() => expect(cancelInvitation).toHaveBeenCalledWith(8));
    expect(cancelInvitation).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(getCompanyMembers.mock.calls.length).toBeGreaterThan(1));
  });

  it("si el reenvio tampoco pudo mandar el correo, lo dice", async () => {
    resendInvitation.mockResolvedValue({ invitation: invitacion({ id: 8 }), email_sent: false });
    getCompanyMembers.mockResolvedValue(dos());
    render(<AdminCompanyClient />);
    await tablaCon(2);
    fireEvent.click(screen.getByRole("button", {
      name: /resend the invitation to bbb@hotel\.com/i,
    }));
    await waitFor(() => expect(
      screen.getByText(/still could not send the email to bbb@hotel.com/i),
    ).toBeInTheDocument());
  });

  it("un 409 interno del reenvio no pinta el texto del backend", async () => {
    resendInvitation.mockRejectedValue(Object.assign(
      new Error("solo se reenvian invitaciones pendientes"),
      { status: 409 },
    ));
    getCompanyMembers.mockResolvedValue(dos());
    render(<AdminCompanyClient />);
    await tablaCon(2);
    fireEvent.click(screen.getByRole("button", {
      name: /resend the invitation to aaa@hotel\.com/i,
    }));
    await waitFor(() => expect(
      screen.getByText(/no longer available. reload the page/i),
    ).toBeInTheDocument());
    expect(document.body.textContent).not.toMatch(/se reenvian/i);
  });

  it("el vencimiento de una invitacion pendiente se muestra, en texto", async () => {
    getCompanyMembers.mockResolvedValue(respuesta({
      members: [],
      invitations: [invitacion({ id: 7, email: "aaa@hotel.com" })],
      total: 0,
    }));
    render(<AdminCompanyClient />);
    await tablaCon(1);
    // La vigencia es de 72 h y el estado es binario: sin esto el jefe no puede
    // saber si a la invitacion le quedan 2 horas o 70.
    expect(filas()[0].textContent).toMatch(/expires in 54 h/i);
  });

  it("una invitacion vencida no dice que vence en algo, ya lo dice su estado", async () => {
    getCompanyMembers.mockResolvedValue(respuesta({
      members: [],
      invitations: [invitacion({
        id: 7,
        expired: true,
        expires_at: new Date(Date.now() - 3600 * 1000).toISOString(),
      })],
      total: 0,
    }));
    render(<AdminCompanyClient />);
    await tablaCon(1);
    expect(screen.getByText(/invitation expired/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/expires in/i);
  });
});

describe("editar los datos de una persona", () => {
  async function abrirEdicion() {
    getCompanyMembers.mockResolvedValue(respuesta({ members: [miembro()], total: 1 }));
    render(<AdminCompanyClient />);
    await tablaCon(1);
    fireEvent.click(screen.getByRole("button", { name: /^edit juan perez$/i }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
  }

  it("el cuerpo del PATCH usa los nombres de ESCRITURA del backend", async () => {
    // LA TRAMPA: el GET devuelve firstname/lastname/phone/lang_code y el PATCH
    // exige usr_firstname/usr_lastname/usr_phone/lang_code. El backend descarta
    // en silencio lo que no este en su lista blanca, asi que mandar los nombres
    // de lectura GUARDA SIN GUARDAR NADA.
    await abrirEdicion();
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: "Juana" } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: "Perez Gomez" } });
    fireEvent.change(screen.getByLabelText(/phone/i), { target: { value: "3009998877" } });
    fireEvent.change(screen.getByLabelText(/language/i), { target: { value: "en" } });
    fireEvent.click(screen.getByRole("button", { name: /^save changes$/i }));
    await waitFor(() => expect(updateCompanyMember).toHaveBeenCalledWith(1, {
      usr_firstname: "Juana",
      usr_lastname: "Perez Gomez",
      usr_phone: "3009998877",
      lang_code: "en",
    }));
  });

  it("el formulario llega con los datos que tiene hoy la persona", async () => {
    await abrirEdicion();
    expect(screen.getByLabelText(/first name/i)).toHaveValue("Juan");
    expect(screen.getByLabelText(/last name/i)).toHaveValue("Perez");
    expect(screen.getByLabelText(/phone/i)).toHaveValue("3001112233");
    expect(screen.getByLabelText(/language/i)).toHaveValue("es");
  });

  it("guardar cierra el formulario, recarga la lista y lo dice", async () => {
    await abrirEdicion();
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: "Juana" } });
    fireEvent.click(screen.getByRole("button", { name: /^save changes$/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(getCompanyMembers.mock.calls.length).toBeGreaterThan(1);
    expect(screen.getByText(/changes saved/i)).toBeInTheDocument();
  });

  it("un nombre de mas de 50 caracteres se rechaza EN LA PANTALLA, sin llamar al backend", async () => {
    await abrirEdicion();
    fireEvent.change(screen.getByLabelText(/first name/i), {
      target: { value: "A".repeat(51) },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save changes$/i }));
    await waitFor(() => expect(
      screen.getByText(/use 50 characters or fewer/i),
    ).toBeInTheDocument());
    expect(updateCompanyMember).not.toHaveBeenCalled();
    // El mensaje va DEBAJO de su campo y el campo queda marcado como invalido.
    const campo = screen.getByLabelText(/first name/i);
    expect(campo).toHaveAttribute("aria-invalid", "true");
    const idDelError = campo.getAttribute("aria-describedby");
    expect(document.getElementById(idDelError).textContent).toMatch(/50 characters/i);
  });

  it("un telefono de mas de 20 caracteres tambien, con SU tope", async () => {
    await abrirEdicion();
    fireEvent.change(screen.getByLabelText(/phone/i), { target: { value: "9".repeat(21) } });
    fireEvent.click(screen.getByRole("button", { name: /^save changes$/i }));
    await waitFor(() => expect(
      screen.getByText(/use 20 characters or fewer/i),
    ).toBeInTheDocument());
    expect(updateCompanyMember).not.toHaveBeenCalled();
  });

  it("si el backend rechaza el cuerpo, su prosa espanola no se pinta", async () => {
    updateCompanyMember.mockRejectedValue(Object.assign(
      new Error(""),
      { status: 400, errors: { usr_firstname: "máximo 50 caracteres" } },
    ));
    await abrirEdicion();
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: "Juana" } });
    fireEvent.click(screen.getByRole("button", { name: /^save changes$/i }));
    await waitFor(() => expect(screen.getByRole("dialog").textContent)
      .toMatch(/too long/i));
    expect(document.body.textContent).not.toMatch(/caracteres/i);
    // El formulario NO se cierra: la persona tiene que poder corregir.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("Escape cierra el formulario sin guardar nada", async () => {
    await abrirEdicion();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(updateCompanyMember).not.toHaveBeenCalled();
  });
});

describe("los dos dialogos destructivos", () => {
  async function conUnMiembro(extra = {}) {
    getCompanyMembers.mockResolvedValue(respuesta({ members: [miembro(extra)], total: 1 }));
    render(<AdminCompanyClient />);
    await tablaCon(1);
  }

  it("desactivar pide confirmacion, explica que se puede revertir, y no actua antes", async () => {
    await conUnMiembro();
    fireEvent.click(screen.getByRole("button", { name: /^turn off access for juan perez$/i }));
    const dialogo = await screen.findByRole("dialog");
    expect(deactivateCompanyMember).not.toHaveBeenCalled();
    expect(dialogo.textContent).toMatch(/can be undone/i);
    expect(dialogo.textContent).toMatch(/stays on your team/i);
    fireEvent.click(screen.getByRole("button", { name: /^turn off access$/i }));
    await waitFor(() => expect(deactivateCompanyMember).toHaveBeenCalledWith(1));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(getCompanyMembers.mock.calls.length).toBeGreaterThan(1);
  });

  it("desvincular pide confirmacion y explica en que se DIFERENCIA de desactivar", async () => {
    await conUnMiembro();
    fireEvent.click(screen.getByRole("button", {
      name: /^remove juan perez from your team$/i,
    }));
    const dialogo = await screen.findByRole("dialog");
    expect(unlinkCompanyMember).not.toHaveBeenCalled();
    // Lo que lo distingue: sale del equipo, y volver exige invitarla de nuevo.
    expect(dialogo.textContent).toMatch(/leaves your team/i);
    expect(dialogo.textContent).toMatch(/invite them again/i);
    fireEvent.click(screen.getByRole("button", { name: /^remove from team$/i }));
    await waitFor(() => expect(unlinkCompanyMember).toHaveBeenCalledWith(1));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("los dos dialogos dicen cosas DISTINTAS: no son el mismo texto", async () => {
    await conUnMiembro();
    fireEvent.click(screen.getByRole("button", { name: /^turn off access for juan perez$/i }));
    const textoDesactivar = (await screen.findByRole("dialog")).textContent;
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", {
      name: /^remove juan perez from your team$/i,
    }));
    const textoDesvincular = (await screen.findByRole("dialog")).textContent;
    expect(textoDesvincular).not.toBe(textoDesactivar);
  });

  it("ninguno usa window.confirm ni alert: bloquearian la pagina entera", async () => {
    const confirmar = vi.spyOn(window, "confirm").mockReturnValue(true);
    const avisar = vi.spyOn(window, "alert").mockImplementation(() => {});
    await conUnMiembro();
    fireEvent.click(screen.getByRole("button", {
      name: /^remove juan perez from your team$/i,
    }));
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: /^remove from team$/i }));
    await waitFor(() => expect(unlinkCompanyMember).toHaveBeenCalled());
    expect(confirmar).not.toHaveBeenCalled();
    expect(avisar).not.toHaveBeenCalled();
    confirmar.mockRestore();
    avisar.mockRestore();
  });

  it("al abrirse, el foco queda en el control de NO hacerlo", async () => {
    // En una accion destructiva el camino por omision del teclado -Enter sobre
    // lo que recibe el foco- no puede ser la destruccion.
    await conUnMiembro();
    fireEvent.click(screen.getByRole("button", { name: /^remove juan perez from your team$/i }));
    await screen.findByRole("dialog");
    await waitFor(() => expect(document.activeElement)
      .toBe(screen.getByRole("button", { name: /^keep as is$/i })));
  });

  it("cancelar el dialogo no ejecuta nada", async () => {
    await conUnMiembro();
    fireEvent.click(screen.getByRole("button", { name: /^turn off access for juan perez$/i }));
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: /^keep as is$/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(deactivateCompanyMember).not.toHaveBeenCalled();
    expect(getCompanyMembers).toHaveBeenCalledTimes(1);
  });

  it("los dialogos no usan ni una palabra del modelo de datos", async () => {
    await conUnMiembro();
    for (const boton of [
      /^turn off access for juan perez$/i,
      /^remove juan perez from your team$/i,
    ]) {
      fireEvent.click(screen.getByRole("button", { name: boton }));
      const dialogo = await screen.findByRole("dialog");
      expect(dialogo.textContent)
        .not.toMatch(/confirmed|placeholder|comp_id|rol_id|\brole\b|\brol\b|usr_|invitation table|company_invitation/i);
      fireEvent.keyDown(document, { key: "Escape" });
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    }
  });

  it("si la recarga falla despues de la escritura, no dice que no cambio nada", async () => {
    // Cada accion recarga el listado al terminar, y en Render la recarga puede
    // caer (hasta un minuto para despertar) sobre una escritura que SI ocurrio.
    // La vista de fallo dice "Nothing has changed", que ahi seria falso.
    getCompanyMembers
      .mockResolvedValueOnce(respuesta({ members: [miembro()], total: 1 }))
      .mockRejectedValue(new TypeError("Failed to fetch"));
    render(<AdminCompanyClient />);
    await tablaCon(1);
    fireEvent.click(screen.getByRole("button", {
      name: /^remove juan perez from your team$/i,
    }));
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: /^remove from team$/i }));
    await waitFor(() => expect(
      screen.getByRole("button", { name: /try again/i }),
    ).toBeInTheDocument());
    expect(screen.getByText(/juan perez is no longer on your team/i)).toBeInTheDocument();
  });

  it("a quien ya esta desactivado no se le ofrece desactivar otra vez", async () => {
    await conUnMiembro({ active: false });
    expect(screen.getByRole("button", { name: /^remove juan perez from your team$/i }))
      .toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^turn off access for juan perez$/i }))
      .not.toBeInTheDocument();
  });

  it("un 409 de 'tiene datos asociados' se traduce", async () => {
    unlinkCompanyMember.mockRejectedValue(Object.assign(
      new Error("la cuenta tiene datos asociados"),
      { status: 409 },
    ));
    await conUnMiembro();
    fireEvent.click(screen.getByRole("button", {
      name: /^remove juan perez from your team$/i,
    }));
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: /^remove from team$/i }));
    await waitFor(() => expect(screen.getByText(/needs manual review/i)).toBeInTheDocument());
    expect(document.body.textContent).not.toMatch(/datos asociados/i);
  });
});

describe("las filas sobre las que el jefe no puede actuar", () => {
  it("la fila de un par administrador no muestra NINGUN boton, y no lleva el enganche", async () => {
    getCompanyMembers.mockResolvedValue(respuesta({
      members: [
        miembro({ id: 1, rol_id: 3 }),
        miembro({ id: 2, rol_id: 4, email: "jefa@hotel.com", firstname: "Ana", lastname: "Jefa" }),
      ],
      total: 2,
    }));
    render(<AdminCompanyClient />);
    await tablaCon(2);
    const [filaDeAna, filaDeJuan] = filas();   // ordenadas por nombre: Ana, Juan
    expect(filaDeAna.textContent).toContain("Ana Jefa");
    expect(filaDeAna.querySelectorAll("button")).toHaveLength(0);
    expect(filaDeAna.querySelector("[data-actions-for]")).toBeNull();
    // Y la del personal SI los lleva: sin esto la prueba pasaria con la tabla
    // entera sin botones.
    expect(filaDeJuan.querySelectorAll("button").length).toBeGreaterThan(0);
    expect(filaDeJuan.querySelector('[data-actions-for="member:1"]')).not.toBeNull();
  });

  it("y no hay forma de editar ni desvincular a un par administrador", async () => {
    getCompanyMembers.mockResolvedValue(respuesta({
      members: [miembro({ id: 2, rol_id: 1, firstname: "Ana", lastname: "Jefa" })],
      total: 1,
    }));
    render(<AdminCompanyClient />);
    await tablaCon(1);
    expect(screen.queryByRole("button", { name: /ana jefa/i })).not.toBeInTheDocument();
    // Tampoco se explica por que: explicarlo exigiria hablar de roles.
    expect(document.body.textContent).not.toMatch(/\brole\b|\brol\b|permission/i);
  });
});

describe("el estado vacio ya no tiene un boton inerte", () => {
  it("el formulario del estado vacio invita de verdad", async () => {
    getCompanyMembers.mockResolvedValue(respuesta({ members: [], invitations: [], total: 0 }));
    render(<AdminCompanyClient />);
    await waitFor(() => expect(screen.getByText(/no one on your team yet/i)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(CAMPO_CORREO), {
      target: { value: "primera@hotel.com" },
    });
    fireEvent.click(screen.getByRole("button", BOTON_INVITAR));
    await waitFor(() => expect(addCompanyMember).toHaveBeenCalledWith("primera@hotel.com"));
  });
});
