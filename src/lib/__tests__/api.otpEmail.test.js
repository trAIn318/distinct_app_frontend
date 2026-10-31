import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

import { loginApi, registerApi } from "../api";

// El backend responde 502 cuando no pudo enviar el código de verificación. Sin
// el estado en el error, la pantalla no puede distinguir ese caso de unas
// credenciales malas y acaba pintando la frase del backend en inglés — la misma
// fuga que ya se cerró en el panel de Admin Company.
function respuesta(status, cuerpo) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(cuerpo),
  };
}

beforeEach(() => {
  global.fetch = vi.fn();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("el error de la API lleva el estado HTTP", () => {
  it("loginApi marca el 502 del correo no enviado", async () => {
    global.fetch.mockResolvedValue(
      respuesta(502, { detail: "We could not send the verification code." }),
    );
    await expect(loginApi("user", "secret123")).rejects.toMatchObject({
      status: 502,
    });
  });

  it("loginApi sigue marcando el 401 de credenciales malas", async () => {
    global.fetch.mockResolvedValue(
      respuesta(401, { detail: "Invalid credentials." }),
    );
    await expect(loginApi("user", "mala")).rejects.toMatchObject({
      status: 401,
    });
  });

  it("registerApi marca el 502 del correo no enviado", async () => {
    global.fetch.mockResolvedValue(
      respuesta(502, { detail: "We could not send the verification code." }),
    );
    await expect(registerApi({ username: "x" })).rejects.toMatchObject({
      status: 502,
    });
  });

  it("registerApi marca el estado tambien cuando el error viene por campo", async () => {
    global.fetch.mockResolvedValue(
      respuesta(409, { email: ["Email already registered."] }),
    );
    await expect(registerApi({ username: "x" })).rejects.toMatchObject({
      status: 409,
    });
  });

  it("una respuesta buena no lanza", async () => {
    global.fetch.mockResolvedValue(respuesta(200, { access: "t" }));
    await expect(loginApi("user", "secret123")).resolves.toMatchObject({
      access: "t",
    });
  });
});
