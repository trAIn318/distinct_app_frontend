import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  render, screen, cleanup, waitFor, fireEvent,
} from "@testing-library/react";

// Mismo trato que en el login: si el backend no pudo enviar el código de
// activación (502), la pantalla lo dice traducido y NO pasa al paso del código.
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));

const registerApi = vi.fn();
const verifyRegisterOtpApi = vi.fn();
vi.mock("../../../lib/api", () => ({
  registerApi: (...a) => registerApi(...a),
  verifyRegisterOtpApi: (...a) => verifyRegisterOtpApi(...a),
}));

vi.mock("../../../lib/session", () => ({ saveSession: vi.fn() }));

import RegisterForm from "../RegisterForm";
import en from "../../../i18n/messages/en.json";

afterEach(cleanup);
beforeEach(() => {
  push.mockClear();
  registerApi.mockReset();
  verifyRegisterOtpApi.mockReset();
});

function llenarYEnviar() {
  const campos = {
    "First name": "New",
    "Last name": "Bie",
    Username: "newbie",
    Email: "newbie@example.com",
    Password: "Correct123!",
    "Confirm password": "Correct123!",
  };
  // Coincidencia exacta a propósito: "Password" con `exact: false` también
  // atrapa "Confirm password" y la consulta queda ambigua.
  for (const [etiqueta, valor] of Object.entries(campos)) {
    fireEvent.change(screen.getByLabelText(etiqueta), {
      target: { value: valor },
    });
  }
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: en.register.submit }));
}

function errorConEstado(mensaje, status) {
  const err = new Error(mensaje);
  err.status = status;
  return err;
}

describe("registro cuando el codigo no se pudo enviar", () => {
  it("avisa traducido y no pasa al paso del codigo", async () => {
    registerApi.mockRejectedValue(
      errorConEstado("We could not send the verification code.", 502),
    );
    render(<RegisterForm />);
    llenarYEnviar();
    await waitFor(() =>
      expect(screen.getByText(en.register.errEmailNotSent)).toBeInTheDocument()
    );
    expect(screen.queryByText(en.register.otpInfo)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/could not send the verification code/i)
    ).not.toBeInTheDocument();
  });

  it("otro error de registro sigue mostrando su propio mensaje", async () => {
    registerApi.mockRejectedValue(
      errorConEstado("Username already taken.", 409),
    );
    render(<RegisterForm />);
    llenarYEnviar();
    await waitFor(() =>
      expect(screen.getByText("Username already taken.")).toBeInTheDocument()
    );
    expect(
      screen.queryByText(en.register.errEmailNotSent)
    ).not.toBeInTheDocument();
  });

  it("un registro exitoso pasa al paso del codigo", async () => {
    registerApi.mockResolvedValue({ requires_otp: true, channel: "email" });
    render(<RegisterForm />);
    llenarYEnviar();
    await waitFor(() =>
      expect(screen.getByText(en.register.otpInfo)).toBeInTheDocument()
    );
  });
});
