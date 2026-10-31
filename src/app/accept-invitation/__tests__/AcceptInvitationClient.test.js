import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";

const push = vi.fn();
const refresh = vi.fn();
let search = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
  useSearchParams: () => search,
}));

const getInvitationInfo = vi.fn();
const acceptInvitation = vi.fn();
vi.mock("../../../lib/api", () => ({
  getInvitationInfo: (...a) => getInvitationInfo(...a),
  acceptInvitation: (...a) => acceptInvitation(...a),
}));

const saveSession = vi.fn();
vi.mock("../../../lib/session", () => ({ saveSession: (...a) => saveSession(...a) }));
vi.mock("../../../lib/preferences", () => ({ loadServerPreferences: vi.fn() }));

import AcceptInvitationClient from "../AcceptInvitationClient";

// Sin I18nProvider, useT cae al ingles de en.json.
// El nombre accesible incluye ahora el indicador de obligatorio y su texto para
// lectores de pantalla ("Password * (Required)"), que claude.md pide juntos.
const PASS = /^password \*/i;
const CONFIRM = /^confirm password \*/i;
const CONSENT = /i accept the data processing policy/i;
const ACTIVAR = /activate my account/i;
const UNIRSE = /join this team/i;
const ENLACE_MALO = /this link is no longer valid/i;

function sesion() {
  return { access: "a", refresh: "r", user: { id: 9 } };
}

beforeEach(() => {
  push.mockClear(); refresh.mockClear(); saveSession.mockReset();
  getInvitationInfo.mockReset(); acceptInvitation.mockReset();
  search = new URLSearchParams("token=tkn");
});
afterEach(cleanup);

describe("cuando el enlace no sirve", () => {
  it("sin token muestra el aviso y NO llama al backend", async () => {
    search = new URLSearchParams();
    render(<AcceptInvitationClient />);
    await waitFor(() => expect(screen.getByText(ENLACE_MALO)).toBeInTheDocument());
    expect(getInvitationInfo).not.toHaveBeenCalled();
  });

  it("un token basura o larguisimo muestra el mismo aviso y no revienta", async () => {
    getInvitationInfo.mockRejectedValue(Object.assign(new Error("nope"), { status: 404 }));
    search = new URLSearchParams(`token=${"x".repeat(5000)}`);
    expect(() => render(<AcceptInvitationClient />)).not.toThrow();
    await waitFor(() => expect(screen.getByText(ENLACE_MALO)).toBeInTheDocument());
  });

  it("el aviso ofrece una salida a iniciar sesion", async () => {
    search = new URLSearchParams();
    render(<AcceptInvitationClient />);
    await waitFor(() => expect(screen.getByRole("link", { name: /go to sign in/i }))
      .toHaveAttribute("href", "/login"));
  });
});

describe("cuenta nueva", () => {
  beforeEach(() => {
    getInvitationInfo.mockResolvedValue({ kind: "new", company_name: "T2T" });
  });

  it("pide contrasena dos veces Y el consentimiento, que el backend exige", async () => {
    render(<AcceptInvitationClient />);
    await waitFor(() => expect(screen.getByLabelText(PASS)).toBeInTheDocument());
    expect(screen.getByLabelText(CONFIRM)).toBeInTheDocument();
    expect(screen.getByLabelText(CONSENT)).toBeInTheDocument();
  });

  it("muestra la empresa y NUNCA un correo: el backend no lo devuelve", async () => {
    render(<AcceptInvitationClient />);
    await waitFor(() => expect(screen.getByText(/T2T/)).toBeInTheDocument());
    expect(document.body.textContent).not.toMatch(/@/);
  });

  it("no envia sin consentimiento, y el error sale debajo del campo", async () => {
    render(<AcceptInvitationClient />);
    await waitFor(() => expect(screen.getByLabelText(PASS)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(PASS), { target: { value: "Correct123!" } });
    fireEvent.change(screen.getByLabelText(CONFIRM), { target: { value: "Correct123!" } });
    fireEvent.click(screen.getByRole("button", { name: ACTIVAR }));
    await waitFor(() => expect(screen.getByText(/must accept the data processing policy/i))
      .toBeInTheDocument());
    expect(acceptInvitation).not.toHaveBeenCalled();
  });

  it("no envia si las contrasenas no coinciden", async () => {
    render(<AcceptInvitationClient />);
    await waitFor(() => expect(screen.getByLabelText(PASS)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(PASS), { target: { value: "Correct123!" } });
    fireEvent.change(screen.getByLabelText(CONFIRM), { target: { value: "otra" } });
    fireEvent.click(screen.getByLabelText(CONSENT));
    fireEvent.click(screen.getByRole("button", { name: ACTIVAR }));
    await waitFor(() => expect(screen.getByText(/do not match/i)).toBeInTheDocument());
    expect(acceptInvitation).not.toHaveBeenCalled();
  });

  it("al activar guarda la sesion y entra", async () => {
    acceptInvitation.mockResolvedValue(sesion());
    render(<AcceptInvitationClient />);
    await waitFor(() => expect(screen.getByLabelText(PASS)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(PASS), { target: { value: "Correct123!" } });
    fireEvent.change(screen.getByLabelText(CONFIRM), { target: { value: "Correct123!" } });
    fireEvent.click(screen.getByLabelText(CONSENT));
    fireEvent.click(screen.getByRole("button", { name: ACTIVAR }));
    await waitFor(() => expect(saveSession).toHaveBeenCalledWith(
      expect.objectContaining({ access: "a", refresh: "r" })));
    expect(acceptInvitation).toHaveBeenCalledWith("tkn", expect.objectContaining({
      password: "Correct123!", acceptPolicy: true,
    }));
    await waitFor(() => expect(push).toHaveBeenCalled());
  });

  it("doble clic envia UNA sola vez", async () => {
    let resolver;
    acceptInvitation.mockReturnValue(new Promise((r) => { resolver = r; }));
    render(<AcceptInvitationClient />);
    await waitFor(() => expect(screen.getByLabelText(PASS)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(PASS), { target: { value: "Correct123!" } });
    fireEvent.change(screen.getByLabelText(CONFIRM), { target: { value: "Correct123!" } });
    fireEvent.click(screen.getByLabelText(CONSENT));
    const boton = screen.getByRole("button", { name: ACTIVAR });
    fireEvent.click(boton);
    fireEvent.click(boton);
    fireEvent.click(boton);
    await waitFor(() => expect(acceptInvitation).toHaveBeenCalledTimes(1));
    resolver(sesion());
  });

  it("un error del backend se muestra traducido, no en el idioma del backend", async () => {
    // Texto EXACTO del backend (api/invitation_views.py:80). Mi version anterior
    // inventaba una traduccion al espanol que el backend nunca envia.
    acceptInvitation.mockRejectedValue(
      Object.assign(new Error("This account already belongs to a company."), { status: 409 }));
    render(<AcceptInvitationClient />);
    await waitFor(() => expect(screen.getByLabelText(PASS)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(PASS), { target: { value: "Correct123!" } });
    fireEvent.change(screen.getByLabelText(CONFIRM), { target: { value: "Correct123!" } });
    fireEvent.click(screen.getByLabelText(CONSENT));
    fireEvent.click(screen.getByRole("button", { name: ACTIVAR }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByRole("alert").textContent).toMatch(/already belongs to a company/i);
    expect(saveSession).not.toHaveBeenCalled();
  });
});

describe("cuenta que ya existe (un clic)", () => {
  beforeEach(() => {
    getInvitationInfo.mockResolvedValue({ kind: "join", company_name: "Mucura" });
  });

  it("no pide contrasena ni consentimiento: el backend los ignoraria", async () => {
    render(<AcceptInvitationClient />);
    await waitFor(() => expect(screen.getByRole("button", { name: UNIRSE })).toBeInTheDocument());
    expect(screen.queryByLabelText(PASS)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(CONSENT)).not.toBeInTheDocument();
  });

  it("confirma con el cuerpo vacio y entra", async () => {
    acceptInvitation.mockResolvedValue(sesion());
    render(<AcceptInvitationClient />);
    await waitFor(() => expect(screen.getByRole("button", { name: UNIRSE })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: UNIRSE }));
    await waitFor(() => expect(acceptInvitation).toHaveBeenCalledWith("tkn", {}));
    await waitFor(() => expect(push).toHaveBeenCalled());
  });
});

describe("lo que la revision encontro sin cercar", () => {
  async function montarNueva() {
    getInvitationInfo.mockResolvedValue({ kind: "new", company_name: "T2T" });
    render(<AcceptInvitationClient />);
    await waitFor(() => expect(screen.getByLabelText(PASS)).toBeInTheDocument());
  }

  it("el backend dormido NO se presenta como enlace muerto: ofrece reintentar", async () => {
    // Render free tarda ~30-60 s en despertar y esta es la PRIMERA peticion de
    // una persona nueva. Decirle que su enlace murio la manda a pedir otro, que
    // es justo lo que no la va a ayudar. Solo un 404 significa enlace muerto.
    getInvitationInfo.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<AcceptInvitationClient />);
    await waitFor(() => expect(screen.getByRole("button", { name: /try again/i }))
      .toBeInTheDocument());
    expect(screen.queryByText(ENLACE_MALO)).not.toBeInTheDocument();
  });

  it("un 429 del throttle tampoco: es compartido entre consultar y aceptar", async () => {
    // 20/min por IP: 20 empleados tras el mismo NAT corporativo lo agotan.
    getInvitationInfo.mockRejectedValue(Object.assign(new Error(""), { status: 429 }));
    render(<AcceptInvitationClient />);
    await waitFor(() => expect(screen.getByRole("button", { name: /try again/i }))
      .toBeInTheDocument());
  });

  it("solo un 404 muestra el enlace muerto", async () => {
    getInvitationInfo.mockRejectedValue(Object.assign(new Error(""), { status: 404 }));
    render(<AcceptInvitationClient />);
    await waitFor(() => expect(screen.getByText(ENLACE_MALO)).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /try again/i })).not.toBeInTheDocument();
  });

  it("reintentar vuelve a consultar y entra si ya desperto", async () => {
    getInvitationInfo
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({ kind: "new", company_name: "T2T" });
    render(<AcceptInvitationClient />);
    await waitFor(() => expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    await waitFor(() => expect(screen.getByLabelText(PASS)).toBeInTheDocument());
  });

  it("una contrasena de menos de 8 dice POR QUE, sin llamar al backend", async () => {
    // El backend exige min_length=8 y su 400 trae los errores de campo de DRF al
    // tope del cuerpo, una forma que la capa de red no leia: la persona veia
    // "no se pudo activar tu cuenta" tantas veces como lo intentara.
    await montarNueva();
    fireEvent.change(screen.getByLabelText(PASS), { target: { value: "corto1" } });
    fireEvent.change(screen.getByLabelText(CONFIRM), { target: { value: "corto1" } });
    fireEvent.click(screen.getByLabelText(CONSENT));
    fireEvent.click(screen.getByRole("button", { name: ACTIVAR }));
    await waitFor(() => expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument());
    expect(acceptInvitation).not.toHaveBeenCalled();
  });

  it("una contrasena vacia tambien dice por que", async () => {
    await montarNueva();
    fireEvent.click(screen.getByRole("button", { name: ACTIVAR }));
    await waitFor(() => expect(screen.getByText(/choose a password/i)).toBeInTheDocument());
    expect(acceptInvitation).not.toHaveBeenCalled();
  });

  it("un kind desconocido pide contrasena, que es la direccion recuperable", async () => {
    // Equivocarse hacia "cuenta nueva" es recuperable: el backend ignora el
    // cuerpo para join. Hacia "un clic" deja a la persona pulsando un boton que
    // falla sin decirle por que.
    getInvitationInfo.mockResolvedValue({ kind: "otro", company_name: "ACME" });
    render(<AcceptInvitationClient />);
    await waitFor(() => expect(screen.getByLabelText(PASS)).toBeInTheDocument());
  });

  it("sin nombre de empresa la frase no queda truncada", async () => {
    // company_name puede venir nulo (invitation_views.py:55) y es la UNICA
    // informacion que identifica a que se esta uniendo la persona.
    getInvitationInfo.mockResolvedValue({ kind: "new", company_name: null });
    render(<AcceptInvitationClient />);
    await waitFor(() => expect(screen.getByText(/invited to join a team/i)).toBeInTheDocument());
  });

  it("un error del backend que contenga un correo NO se pinta en pantalla", async () => {
    // La prueba anterior corria contra un mock sin correo, asi que no podia
    // fallar por construccion. El backend promete no revelar que una direccion
    // fue invitada, y el frontend tiene que sostenerlo aunque un mensaje futuro
    // la mencione.
    await montarNueva();
    acceptInvitation.mockRejectedValue(Object.assign(
      new Error("User maria.lopez@cliente.com is already registered."), { status: 400 }));
    fireEvent.change(screen.getByLabelText(PASS), { target: { value: "Correct123!" } });
    fireEvent.change(screen.getByLabelText(CONFIRM), { target: { value: "Correct123!" } });
    fireEvent.click(screen.getByLabelText(CONSENT));
    fireEvent.click(screen.getByRole("button", { name: ACTIVAR }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(document.body.textContent).not.toContain("maria.lopez@cliente.com");
    expect(document.body.textContent).not.toMatch(/@/);
  });

  it("el guard de doble envio funciona SIN depender del boton deshabilitado", async () => {
    // Las dos mutaciones -quitar el guard y quitar el disabled- sobrevivian por
    // separado, asi que la prueba anterior no decia cual seguia vivo. Un submit
    // del formulario ignora `disabled`, asi que prueba el guard de verdad.
    let resolver;
    acceptInvitation.mockReturnValue(new Promise((r) => { resolver = r; }));
    await montarNueva();
    fireEvent.change(screen.getByLabelText(PASS), { target: { value: "Correct123!" } });
    fireEvent.change(screen.getByLabelText(CONFIRM), { target: { value: "Correct123!" } });
    fireEvent.click(screen.getByLabelText(CONSENT));
    const form = document.querySelector("form");
    fireEvent.submit(form);
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(acceptInvitation).toHaveBeenCalledTimes(1));
    resolver(sesion());
  });

  it("y el boton se deshabilita mientras hay una peticion en curso", async () => {
    // Lo exige el Review Focus 4 del plan, y nada lo fijaba.
    let resolver;
    acceptInvitation.mockReturnValue(new Promise((r) => { resolver = r; }));
    await montarNueva();
    fireEvent.change(screen.getByLabelText(PASS), { target: { value: "Correct123!" } });
    fireEvent.change(screen.getByLabelText(CONFIRM), { target: { value: "Correct123!" } });
    fireEvent.click(screen.getByLabelText(CONSENT));
    fireEvent.click(screen.getByRole("button", { name: ACTIVAR }));
    await waitFor(() => expect(screen.getByRole("button", { name: /activating/i })).toBeDisabled());
    resolver(sesion());
  });

  it("los campos de contrasena son de tipo password y obligatorios", async () => {
    await montarNueva();
    for (const campo of [screen.getByLabelText(PASS), screen.getByLabelText(CONFIRM)]) {
      expect(campo).toHaveAttribute("type", "password");
      expect(campo).toBeRequired();
    }
  });

  it("el error de un campo queda asociado al campo para un lector de pantalla", async () => {
    await montarNueva();
    fireEvent.click(screen.getByRole("button", { name: ACTIVAR }));
    await waitFor(() => expect(screen.getByLabelText(PASS))
      .toHaveAttribute("aria-describedby", "password-error"));
    expect(document.getElementById("password-error")).toHaveAttribute("role", "alert");
  });

  it("el enlace a la politica apunta a la pagina que existe", async () => {
    await montarNueva();
    expect(screen.getByRole("link", { name: /read the policy/i }))
      .toHaveAttribute("href", "/privacy-policy");
  });

  it("guarda tambien el usuario, sin el cual se pierden el menu y el guard de rutas", async () => {
    acceptInvitation.mockResolvedValue(sesion());
    await montarNueva();
    fireEvent.change(screen.getByLabelText(PASS), { target: { value: "Correct123!" } });
    fireEvent.change(screen.getByLabelText(CONFIRM), { target: { value: "Correct123!" } });
    fireEvent.click(screen.getByLabelText(CONSENT));
    fireEvent.click(screen.getByRole("button", { name: ACTIVAR }));
    await waitFor(() => expect(saveSession).toHaveBeenCalledWith(
      { access: "a", refresh: "r", user: { id: 9 } }));
  });

  it("entra a la home y no a /dashboard, que es un shim que rebota", async () => {
    acceptInvitation.mockResolvedValue(sesion());
    await montarNueva();
    fireEvent.change(screen.getByLabelText(PASS), { target: { value: "Correct123!" } });
    fireEvent.change(screen.getByLabelText(CONFIRM), { target: { value: "Correct123!" } });
    fireEvent.click(screen.getByLabelText(CONSENT));
    fireEvent.click(screen.getByRole("button", { name: ACTIVAR }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  });
});
