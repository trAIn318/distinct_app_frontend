import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const getAccessToken = vi.fn();
vi.mock("../session", () => ({ getAccessToken: (...a) => getAccessToken(...a) }));

import { iniciarCheckout } from "../api";

let fetchMock;

function respuesta(body, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) };
}

beforeEach(() => {
  getAccessToken.mockReset().mockReturnValue("tok-123");
  fetchMock = vi.fn().mockResolvedValue(respuesta({ url: "https://stripe.test/c" }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function ultimaLlamada() {
  const [url, opts] = fetchMock.mock.calls.at(-1);
  return { url, opts: opts || {} };
}

describe("iniciarCheckout", () => {
  it("con un plan manda exactamente {plan_code} y el Content-Type JSON", async () => {
    const datos = await iniciarCheckout("essential");
    const { url, opts } = ultimaLlamada();
    expect(url).toMatch(/\/api\/pay\/checkout\/$/);
    expect(opts.method).toBe("POST");
    expect(opts.body).toBe('{"plan_code":"essential"}');
    expect(opts.headers["Content-Type"]).toBe("application/json");
    expect(opts.headers.Authorization).toBe("Bearer tok-123");
    expect(datos).toEqual({ url: "https://stripe.test/c" });
  });

  it("sin argumento no manda cuerpo (el botón del plan ya asignado)", async () => {
    await iniciarCheckout();
    const { opts } = ultimaLlamada();
    expect(opts.method).toBe("POST");
    expect(opts).not.toHaveProperty("body");
    expect(opts.headers).not.toHaveProperty("Content-Type");
  });

  it.each([
    ["texto vacío", ""],
    ["un objeto (p. ej. el evento de un clic)", { type: "click" }],
    ["un número", 7],
    ["null", null],
  ])("%s no cuenta como plan: no manda cuerpo", async (_nombre, valor) => {
    await iniciarCheckout(valor);
    const { opts } = ultimaLlamada();
    expect(opts).not.toHaveProperty("body");
    expect(opts.headers).not.toHaveProperty("Content-Type");
  });
});
