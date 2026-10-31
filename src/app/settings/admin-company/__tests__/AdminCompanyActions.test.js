import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent, within } from "@testing-library/react";

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
const activateCompanyMember = vi.fn();
const unlinkCompanyMember = vi.fn();
vi.mock("../../../../lib/api", () => ({
  getCompanyMembers: (...a) => getCompanyMembers(...a),
  addCompanyMember: (...a) => addCompanyMember(...a),
  resendInvitation: (...a) => resendInvitation(...a),
  cancelInvitation: (...a) => cancelInvitation(...a),
  updateCompanyMember: (...a) => updateCompanyMember(...a),
  deactivateCompanyMember: (...a) => deactivateCompanyMember(...a),
  activateCompanyMember: (...a) => activateCompanyMember(...a),
  unlinkCompanyMember: (...a) => unlinkCompanyMember(...a),
}));

import AdminCompanyClient from "../AdminCompanyClient";
import en from "../../../../i18n/messages/en.json";
import es from "../../../../i18n/messages/es.json";

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
    cancelInvitation, updateCompanyMember, deactivateCompanyMember, activateCompanyMember,
    unlinkCompanyMember,
  ]) m.mockReset();
  isAuthenticated.mockReturnValue(true);
  addCompanyMember.mockResolvedValue({ invitation: invitacion({ id: 55 }), email_sent: true });
  resendInvitation.mockResolvedValue({ invitation: invitacion(), email_sent: true });
  cancelInvitation.mockResolvedValue({ detail: "Invitación cancelada." });
  updateCompanyMember.mockResolvedValue({ member: miembro() });
  deactivateCompanyMember.mockResolvedValue({ member: miembro({ active: false }) });
  activateCompanyMember.mockResolvedValue({ member: miembro({ active: true }) });
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

// ── Ronda de arreglos de rama ───────────────────────────────────────────────

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

describe("I1 — lo que la INVITACION si hizo sobrevive a una recarga que falla", () => {
  // `invitar` termina en `recargar()`, y en Render la recarga puede caer (hasta
  // un minuto para despertar) sobre una invitacion que SI se creo. La vista de
  // fallo pintaba `aviso` -las acciones de fila- pero nunca `avisoInvitar`, asi
  // que el jefe leia "Nothing has changed" justo despues de invitar. Con
  // `email_sent: false` perdia ademas el UNICO sitio donde se le dice que el
  // correo no salio, y la invitacion de 72 h se consumia en silencio.

  async function invitarYQueFalleLaRecarga({ email_sent }) {
    addCompanyMember.mockResolvedValue({
      invitation: invitacion({ id: 55, email: "nuevo@hotel.com" }),
      email_sent,
    });
    getCompanyMembers
      .mockResolvedValueOnce(respuesta({ members: [miembro()], total: 1 }))
      .mockRejectedValue(new TypeError("Failed to fetch"));
    render(<AdminCompanyClient />);
    await tablaCon(1);
    fireEvent.change(screen.getByLabelText(CAMPO_CORREO), {
      target: { value: "nuevo@hotel.com" },
    });
    fireEvent.click(screen.getByRole("button", BOTON_INVITAR));
    await waitFor(() => expect(
      screen.getByRole("button", { name: /try again/i }),
    ).toBeInTheDocument());
  }

  it("la invitacion enviada se dice en la vista de fallo", async () => {
    await invitarYQueFalleLaRecarga({ email_sent: true });
    expect(screen.getByText(/invitation sent to nuevo@hotel.com/i)).toBeInTheDocument();
  });

  it("y con el correo sin enviar, el aviso llega con su boton de reenviar", async () => {
    await invitarYQueFalleLaRecarga({ email_sent: false });
    expect(screen.getByText(/could not send the email to nuevo@hotel.com/i))
      .toBeInTheDocument();
    // El boton tiene que FUNCIONAR desde aqui: es la unica salida que le queda.
    fireEvent.click(screen.getByRole("button", { name: /^resend$/i }));
    await waitFor(() => expect(resendInvitation).toHaveBeenCalledWith(55));
  });
});

describe("m1 — las dos vistas que tampoco decian lo que acababa de pasar", () => {
  it("la pagina fuera de rango dice lo que el jefe acaba de hacer", async () => {
    // Saca a la ultima persona de la pagina 2: la recarga vuelve vacia y la
    // pantalla decia "The list changed while you were looking at it",
    // atribuyendole al azar lo que acababa de hacer el.
    getCompanyMembers
      .mockResolvedValueOnce(respuesta({ members: personas(1, 25), total: 26 }))
      .mockResolvedValueOnce(respuesta({ members: [miembro()], total: 26 }))
      .mockResolvedValue(respuesta({ members: [], invitations: [], total: 25 }));
    render(<AdminCompanyClient />);
    await waitFor(() => expect(screen.getByRole("button", { name: /next/i })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    await tablaCon(1);
    fireEvent.click(screen.getByRole("button", {
      name: /^remove juan perez from your team$/i,
    }));
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: /^remove from team$/i }));
    await waitFor(() => expect(
      screen.getByText(/this page no longer has anyone/i),
    ).toBeInTheDocument());
    expect(screen.getByText(/juan perez is no longer on your team/i)).toBeInTheDocument();
  });

  it("y la empresa que se queda vacia tambien", async () => {
    getCompanyMembers
      .mockResolvedValueOnce(respuesta({ members: [miembro()], total: 1 }))
      .mockResolvedValue(respuesta({ members: [], invitations: [], total: 0 }));
    render(<AdminCompanyClient />);
    await tablaCon(1);
    fireEvent.click(screen.getByRole("button", {
      name: /^remove juan perez from your team$/i,
    }));
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: /^remove from team$/i }));
    await waitFor(() => expect(screen.getByText(/no one on your team yet/i)).toBeInTheDocument());
    expect(screen.getByText(/juan perez is no longer on your team/i)).toBeInTheDocument();
  });
});

describe("I2 — el error de un reenvio no es un error del campo de correo", () => {
  it("un fallo de red al reenviar desde el aviso no marca invalido el campo", async () => {
    // `reenviarDelAviso` mandaba el error a `setErrorInvitar`, que es el cajon
    // del CAMPO (con aria-invalid y aria-describedby). Resultado medido: el
    // campo de correo -vacio, porque invitar lo limpia al terminar- quedaba
    // marcado invalido y un lector de pantalla anunciaba invalida la direccion,
    // cuando lo que fallo fue la red.
    addCompanyMember.mockResolvedValue({
      invitation: invitacion({ id: 55, email: "nuevo@hotel.com" }),
      email_sent: false,
    });
    resendInvitation.mockRejectedValue(new TypeError("Failed to fetch"));
    getCompanyMembers.mockResolvedValue(respuesta({ members: [miembro()], total: 1 }));
    render(<AdminCompanyClient />);
    await tablaCon(1);
    fireEvent.change(screen.getByLabelText(CAMPO_CORREO), {
      target: { value: "nuevo@hotel.com" },
    });
    fireEvent.click(screen.getByRole("button", BOTON_INVITAR));
    await waitFor(() => expect(screen.getByRole("button", { name: /^resend$/i }))
      .toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /^resend$/i }));
    // El fallo SI se dice -ninguno falla en silencio-, pero no sobre el campo.
    await waitFor(() => expect(
      screen.getByText(/could not reach the server/i),
    ).toBeInTheDocument());
    const campo = screen.getByLabelText(CAMPO_CORREO);
    expect(campo).toHaveValue("");
    expect(campo).not.toHaveAttribute("aria-invalid");
    expect(campo).not.toHaveAttribute("aria-describedby");
    expect(document.getElementById("invite-email-error")).toBeNull();
  });

  it("y el error del CAMPO sigue yendo al campo", async () => {
    // El positivo que impide cerrar I2 vaciando el cajon del campo.
    getCompanyMembers.mockResolvedValue(respuesta({ members: [miembro()], total: 1 }));
    render(<AdminCompanyClient />);
    await tablaCon(1);
    fireEvent.submit(screen.getByRole("button", BOTON_INVITAR).closest("form"));
    await waitFor(() => expect(screen.getByText(/enter an email address/i)).toBeInTheDocument());
    expect(screen.getByLabelText(CAMPO_CORREO)).toHaveAttribute("aria-invalid", "true");
  });
});

describe("m3 — un 401 en una accion de fila ofrece iniciar sesion", () => {
  it("desde el dialogo destructivo, como ya lo hace el camino de carga", async () => {
    // Dentro del dialogo el mensaje era "Your session ended. Sign in again." SIN
    // ningun control para hacerlo: el unico boton era el de cerrar.
    unlinkCompanyMember.mockRejectedValue(Object.assign(
      new Error("Given token not valid for any token type"),
      { status: 401 },
    ));
    getCompanyMembers.mockResolvedValue(respuesta({ members: [miembro()], total: 1 }));
    render(<AdminCompanyClient />);
    await tablaCon(1);
    fireEvent.click(screen.getByRole("button", {
      name: /^remove juan perez from your team$/i,
    }));
    const dialogo = await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: /^remove from team$/i }));
    await waitFor(() => expect(dialogo.textContent).toMatch(/session ended/i));
    fireEvent.click(within(dialogo).getByRole("button", { name: /^sign in$/i }));
    expect(replace).toHaveBeenCalledWith("/login?next=/settings/admin-company");
  });

  it("y un error que NO es de sesion no ofrece iniciar sesion", async () => {
    // Sin este negativo, el arreglo podria ser un boton que sale siempre.
    unlinkCompanyMember.mockRejectedValue(Object.assign(
      new Error("la cuenta tiene datos asociados"),
      { status: 409 },
    ));
    getCompanyMembers.mockResolvedValue(respuesta({ members: [miembro()], total: 1 }));
    render(<AdminCompanyClient />);
    await tablaCon(1);
    fireEvent.click(screen.getByRole("button", {
      name: /^remove juan perez from your team$/i,
    }));
    const dialogo = await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: /^remove from team$/i }));
    await waitFor(() => expect(dialogo.textContent).toMatch(/needs manual review/i));
    expect(within(dialogo).queryByRole("button", { name: /^sign in$/i })).toBeNull();
  });
});

describe("las dos garantias del dialogo que ninguna prueba sostenia", () => {
  async function conUnMiembro() {
    getCompanyMembers.mockResolvedValue(respuesta({ members: [miembro()], total: 1 }));
    render(<AdminCompanyClient />);
    await tablaCon(1);
  }

  it("M22: Escape NO cierra el dialogo mientras la escritura esta en vuelo", async () => {
    // Cerrarlo ahi dejaria a la persona sin saber en que quedo lo que ya se
    // mando. El guard es `!ocupadoRef.current`, y hasta ahora solo lo afirmaba
    // un comentario.
    const { promesa, resolver } = diferida();
    unlinkCompanyMember.mockReturnValue(promesa);
    await conUnMiembro();
    fireEvent.click(screen.getByRole("button", {
      name: /^remove juan perez from your team$/i,
    }));
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: /^remove from team$/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /working/i }))
      .toBeInTheDocument());
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /working/i })).toBeInTheDocument();
    // Y cuando la escritura termina, el dialogo se va solo.
    resolver({ member: miembro({ comp_id: null }) });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("M52: cerrar el dialogo devuelve el foco a quien lo abrio", async () => {
    // La garantia de accesibilidad que mas facil se rompe sin que nadie lo
    // note: sin ella el foco cae al principio del documento y quien usa teclado
    // tiene que volver a tabular toda la tabla.
    await conUnMiembro();
    const disparador = screen.getByRole("button", {
      name: /^remove juan perez from your team$/i,
    });
    // Un clic de verdad enfoca el boton; `fireEvent.click` no lo hace.
    disparador.focus();
    fireEvent.click(disparador);
    await screen.findByRole("dialog");
    expect(document.activeElement).not.toBe(disparador);
    fireEvent.click(screen.getByRole("button", { name: /^keep as is$/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(document.activeElement).toBe(disparador);
    expect(unlinkCompanyMember).not.toHaveBeenCalled();
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

// ── Devolver el acceso ──────────────────────────────────────────────────────

describe("volver a dar el acceso a quien se desactivo", () => {
  /** DOS personas inactivas, a proposito: con una sola, una mutacion que
   *  apunte siempre a la primera fila del roster sobrevive, y en esta rama eso
   *  ya paso una vez. Se actua sobre la SEGUNDA. */
  function dosInactivas() {
    return respuesta({
      members: [
        miembro({
          id: 11, name: "auno", email: "ana@hotel.com",
          firstname: "Ana", lastname: "Uno", active: false,
        }),
        miembro({
          id: 22, name: "bdos", email: "beto@hotel.com",
          firstname: "Beto", lastname: "Dos", active: false,
        }),
      ],
      total: 2,
    });
  }

  const BOTON_BETO = { name: /^turn access back on for beto dos$/i };

  it("el boton sale SOLO en la fila de quien esta inactivo", async () => {
    getCompanyMembers.mockResolvedValue(respuesta({
      members: [
        miembro({ id: 1, firstname: "Juan", lastname: "Perez", active: true }),
        miembro({
          id: 22, name: "bdos", email: "beto@hotel.com",
          firstname: "Beto", lastname: "Dos", active: false,
        }),
      ],
      invitations: [invitacion({ id: 7, email: "nuevo@hotel.com" })],
      total: 2,
    }));
    render(<AdminCompanyClient />);
    await tablaCon(3);
    // Esta: la fila de quien no puede entrar es la unica que ofrece devolverlo.
    expect(screen.getByRole("button", BOTON_BETO)).toBeInTheDocument();
    // Y en ninguna otra fila: ni en la de quien SI puede entrar, ni en la de
    // una invitacion pendiente, que no es una persona desactivada.
    expect(screen.getAllByRole("button", { name: /turn access back on for/i }))
      .toHaveLength(1);
    expect(screen.queryByRole("button", { name: /^turn access back on for juan perez$/i }))
      .not.toBeInTheDocument();
    // Lo simetrico, que es lo que distingue las dos filas: a quien esta activo
    // se le ofrece quitarle el acceso, y a quien ya no lo tiene no.
    expect(screen.getByRole("button", { name: /^turn off access for juan perez$/i }))
      .toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^turn off access for beto dos$/i }))
      .not.toBeInTheDocument();
  });

  it("actua sobre la persona de SU fila, no sobre la primera", async () => {
    getCompanyMembers.mockResolvedValue(dosInactivas());
    render(<AdminCompanyClient />);
    await tablaCon(2);
    fireEvent.click(screen.getByRole("button", BOTON_BETO));
    await waitFor(() => expect(activateCompanyMember).toHaveBeenCalledWith(22));
    expect(activateCompanyMember).toHaveBeenCalledTimes(1);
    // Y lo dice con el nombre de esa persona, no con el de la otra.
    await waitFor(() => expect(screen.getByText(/beto dos can sign in again/i))
      .toBeInTheDocument());
    expect(screen.queryByText(/ana uno can sign in again/i)).not.toBeInTheDocument();
  });

  it("recarga el listado al terminar, conservando la busqueda", async () => {
    // `recargar()` y NO `empezarCarga()`: este ultimo vuelve a la pantalla de
    // carga, que esconderia el aviso de lo que acaba de pasar.
    getCompanyMembers.mockResolvedValue(dosInactivas());
    render(<AdminCompanyClient />);
    await tablaCon(2);
    fireEvent.change(screen.getByLabelText(/search by name or email/i), {
      target: { value: "dos" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^search$/i }));
    await waitFor(() => expect(getCompanyMembers).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: "dos", offset: 0 })));
    const antes = getCompanyMembers.mock.calls.length;
    // La recarga se deja EN VUELO a proposito: con `empezarCarga()` la pantalla
    // se iria a "cargando" -un solo <p>, sin tabla- y el aviso de lo que acaba
    // de pasar desapareceria debajo. Midiendo despues de que la recarga
    // resuelve, las dos variantes se ven iguales y la prueba no distingue.
    const recarga = diferida();
    getCompanyMembers.mockReturnValueOnce(recarga.promesa);
    fireEvent.click(screen.getByRole("button", BOTON_BETO));
    await waitFor(() => expect(getCompanyMembers.mock.calls.length).toBe(antes + 1));
    expect(getCompanyMembers).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: "dos", offset: 0, limit: 25 }));
    // Con la recarga todavia en vuelo: la tabla sigue a la vista, con el aviso
    // encima, y NO hay pantalla de carga.
    await waitFor(() => expect(screen.getByText(/beto dos can sign in again/i))
      .toBeInTheDocument());
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.queryByText(/^loading/i)).not.toBeInTheDocument();
    recarga.resolver(dosInactivas());
    await waitFor(() => expect(screen.getByRole("table")).toBeInTheDocument());
  });

  it("y conserva la PAGINA en la que estaba", async () => {
    const pagina2 = respuesta({
      members: [miembro({
        id: 22, name: "bdos", email: "beto@hotel.com",
        firstname: "Beto", lastname: "Dos", active: false,
      })],
      total: 30,
    });
    getCompanyMembers
      .mockResolvedValueOnce(respuesta({ members: personas(1, 25), total: 30 }))
      .mockResolvedValue(pagina2);
    render(<AdminCompanyClient />);
    await waitFor(() => expect(screen.getByRole("button", { name: /next/i })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => expect(screen.getByRole("button", BOTON_BETO)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", BOTON_BETO));
    await waitFor(() => expect(activateCompanyMember).toHaveBeenCalledWith(22));
    await waitFor(() => expect(getCompanyMembers).toHaveBeenLastCalledWith(
      expect.objectContaining({ offset: 25 })));
  });

  it("doble clic devuelve el acceso UNA sola vez", async () => {
    const { promesa, resolver } = diferida();
    activateCompanyMember.mockReturnValue(promesa);
    getCompanyMembers.mockResolvedValue(dosInactivas());
    render(<AdminCompanyClient />);
    await tablaCon(2);
    const boton = screen.getByRole("button", BOTON_BETO);
    fireEvent.click(boton);
    fireEvent.click(boton);
    expect(activateCompanyMember).toHaveBeenCalledTimes(1);
    // Los DOS mecanismos, cada uno con su asercion: el boton deshabilitado
    // mientras hay algo en vuelo, y el guard de reentrada del manejador. Con
    // una sola asercion no se puede saber cual de los dos sigue vivo.
    await waitFor(() => expect(boton).toBeDisabled());
    resolver({ member: miembro({ id: 22, active: true }) });
    await waitFor(() => expect(screen.getByText(/beto dos can sign in again/i))
      .toBeInTheDocument());
    expect(activateCompanyMember).toHaveBeenCalledTimes(1);
  });

  it("un fallo de red se muestra traducido, no con la prosa del navegador", async () => {
    // El escenario real: Render (plan free) tarda hasta un minuto en despertar.
    // `Failed to fetch` es prosa del navegador y se pintaria literal.
    activateCompanyMember.mockRejectedValue(new TypeError("Failed to fetch"));
    getCompanyMembers.mockResolvedValue(dosInactivas());
    render(<AdminCompanyClient />);
    await tablaCon(2);
    fireEvent.click(screen.getByRole("button", BOTON_BETO));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByRole("alert").textContent).toMatch(/could not reach the server/i);
    expect(document.body.textContent).not.toMatch(/failed to fetch/i);
    // Y no afirma un exito que no ocurrio.
    expect(screen.queryByText(/can sign in again/i)).not.toBeInTheDocument();
  });

  it("y un 404 sin cuerpo legible se traduce por su ESTADO", async () => {
    // El otro fallo que pasa de verdad: el proxy de Render responde algo que no
    // es JSON, `_cuerpo()` lo convierte en {} y `_errorDe` deja el mensaje
    // vacio. Sin leer el estado, la pantalla no tendria nada que decir.
    activateCompanyMember.mockRejectedValue(Object.assign(new Error(""), { status: 404 }));
    getCompanyMembers.mockResolvedValue(dosInactivas());
    render(<AdminCompanyClient />);
    await tablaCon(2);
    fireEvent.click(screen.getByRole("button", BOTON_BETO));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByRole("alert").textContent).toMatch(/no longer available/i);
    expect(screen.queryByText(/can sign in again/i)).not.toBeInTheDocument();
  });

  it("la fila de un par administrador desactivado sigue sin acciones", async () => {
    getCompanyMembers.mockResolvedValue(respuesta({
      members: [
        miembro({
          id: 22, name: "bdos", email: "beto@hotel.com",
          firstname: "Beto", lastname: "Dos", active: false,
        }),
        miembro({
          id: 2, rol_id: 4, email: "jefa@hotel.com",
          firstname: "Ana", lastname: "Jefa", active: false,
        }),
      ],
      total: 2,
    }));
    render(<AdminCompanyClient />);
    await tablaCon(2);
    const [filaDeAna, filaDeBeto] = filas();   // ordenadas por nombre
    expect(filaDeAna.textContent).toContain("Ana Jefa");
    expect(filaDeAna.querySelectorAll("button")).toHaveLength(0);
    expect(filaDeAna.querySelector("[data-actions-for]")).toBeNull();
    // Y la de la persona del personal SI lo lleva: sin esto la prueba pasaria
    // con la tabla entera sin botones.
    expect(within(filaDeBeto).getByRole("button", BOTON_BETO)).toBeInTheDocument();
  });

  it("la copia de desactivar ya no manda a pedirselo a la plataforma", async () => {
    // LA TRAMPA DE ESTA TAREA: la frase era verdad mientras el jefe no podia
    // revertirlo. Desde que el boton existe, mandarlo a la plataforma es una
    // mentira en pantalla: la accion esta en esta misma lista.
    getCompanyMembers.mockResolvedValue(respuesta({
      members: [miembro({ id: 1, firstname: "Juan", lastname: "Perez" })], total: 1,
    }));
    render(<AdminCompanyClient />);
    await tablaCon(1);
    fireEvent.click(screen.getByRole("button", { name: /^turn off access for juan perez$/i }));
    const dialogo = await screen.findByRole("dialog");
    expect(dialogo.textContent).not.toMatch(/platform administrator/i);
    expect(dialogo.textContent).toMatch(/can be undone/i);
    // Lo que ahora SI es verdad: lo puede devolver el, cuando quiera.
    expect(dialogo.textContent).toMatch(/you can turn their access back on/i);
  });

  it("y tampoco en espanol: la frase falsa no sobrevive en ningun idioma", () => {
    // Las pruebas corren sin I18nProvider, asi que la pantalla solo puede
    // afirmar el ingles. El espanol se mide contra el archivo.
    for (const [idioma, mensajes] of [["en", en], ["es", es]]) {
      const cuerpo = mensajes.companyAdmin.panel.deactivateBody;
      expect(cuerpo, idioma).not.toMatch(/platform administrator|administrador de la plataforma/i);
      expect(cuerpo, idioma).toMatch(/\{name\}/);
    }
    // Y la clave del espanol dice lo que va a ser verdad, no una traduccion
    // generica: el jefe puede devolver el acceso cuando quiera.
    expect(es.companyAdmin.panel.deactivateBody).toMatch(/devolverle el acceso cuando quieras/i);
    expect(en.companyAdmin.panel.deactivateBody).toMatch(/you can turn their access back on/i);
    // Las tres claves nuevas existen en los dos idiomas y ninguna esta vacia.
    for (const clave of ["activate", "activateFor", "activated"]) {
      for (const [idioma, mensajes] of [["en", en], ["es", es]]) {
        expect(mensajes.companyAdmin.panel[clave], `${idioma} ${clave}`).toBeTruthy();
      }
    }
  });
});
