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
const PASS = /^password$/i;
const CONFIRM = /confirm password/i;
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
