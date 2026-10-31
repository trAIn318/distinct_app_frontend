import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  render, screen, cleanup, waitFor, fireEvent,
} from "@testing-library/react";

// Cuando el backend no pudo enviar el código (502), la pantalla NO debe mostrar
// el campo del código: hacerlo deja a la persona esperando para siempre algo
// que nunca salió. Y el aviso va traducido, no con la prosa del backend.
const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
  useSearchParams: () => new URLSearchParams(""),
}));

const loginApi = vi.fn();
const verifyLoginOtpApi = vi.fn();
vi.mock("../../../lib/api", () => ({
  loginApi: (...a) => loginApi(...a),
  verifyLoginOtpApi: (...a) => verifyLoginOtpApi(...a),
  warmBackend: () => {},
}));

const saveSession = vi.fn();
vi.mock("../../../lib/session", () => ({
  saveSession: (...a) => saveSession(...a),
}));

vi.mock("../../../lib/preferences", () => ({
  loadServerPreferences: () => Promise.resolve(null),
}));

import LoginForm from "../LoginForm";
import en from "../../../i18n/messages/en.json";

afterEach(cleanup);
beforeEach(() => {
  push.mockClear();
  loginApi.mockReset();
  verifyLoginOtpApi.mockReset();
  saveSession.mockReset();
});

function enviar(id = "user", pwd = "secret123") {
  fireEvent.change(screen.getByLabelText(/email or username/i), {
    target: { value: id },
  });
  fireEvent.change(screen.getByLabelText(/^password$/i), {
    target: { value: pwd },
  });
  fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
}

function errorConEstado(mensaje, status) {
  const err = new Error(mensaje);
  err.status = status;
  return err;
}

describe("login cuando el codigo no se pudo enviar", () => {
  it("avisa con el texto traducido, no con la frase del backend", async () => {
    loginApi.mockRejectedValue(
      errorConEstado("We could not send the verification code.", 502),
    );
    render(<LoginForm />);
    enviar();
    await waitFor(() =>
      expect(screen.getByText(en.login.errEmailNotSent)).toBeInTheDocument()
    );
    expect(
      screen.queryByText(/could not send the verification code/i)
    ).not.toBeInTheDocument();
  });

  it("no muestra el campo del codigo", async () => {
    loginApi.mockRejectedValue(errorConEstado("lo que sea", 502));
    render(<LoginForm />);
    enviar();
    await waitFor(() =>
      expect(screen.getByText(en.login.errEmailNotSent)).toBeInTheDocument()
    );
    expect(screen.queryByLabelText(/code/i)).not.toBeInTheDocument();
    expect(saveSession).not.toHaveBeenCalled();
  });

  it("un 401 de credenciales sigue mostrando su propio mensaje", async () => {
    loginApi.mockRejectedValue(errorConEstado("Invalid credentials.", 401));
    render(<LoginForm />);
    enviar();
    await waitFor(() =>
      expect(screen.getByText("Invalid credentials.")).toBeInTheDocument()
    );
    expect(
      screen.queryByText(en.login.errEmailNotSent)
    ).not.toBeInTheDocument();
  });
});
