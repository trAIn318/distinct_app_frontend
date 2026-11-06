import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  render, screen, cleanup, waitFor, fireEvent,
} from "@testing-library/react";

// Antes del 2026-11-06 este formulario validaba, hacia console.log, mostraba un
// alert diciendo "exito" y descartaba el mensaje. Y debajo afirmaba estar
// "Protected by Google reCAPTCHA" sin tener ninguna llave: una casilla normal
// marcada en el codigo como "Mock reCAPTCHA".
const sendContactApi = vi.fn();
vi.mock("../../lib/api", () => ({
  sendContactApi: (...a) => sendContactApi(...a),
}));

import ContactForm from "../ContactForm";
import en from "../../i18n/messages/en.json";

afterEach(cleanup);
beforeEach(() => {
  sendContactApi.mockReset();
  sendContactApi.mockResolvedValue({ sent: true });
});

function llenar({ nombre = "Ana Ruiz", correo = "ana@hotelito.com",
                  mensaje = "Quiero una demo." } = {}) {
  fireEvent.change(screen.getByLabelText(en.contact.name), {
    target: { value: nombre },
  });
  fireEvent.change(screen.getByLabelText(/email/i), {
    target: { value: correo },
  });
  const campoMensaje = screen.queryByLabelText(en.contact.message);
  if (campoMensaje) fireEvent.change(campoMensaje, { target: { value: mensaje } });
}

function enviar() {
  fireEvent.click(screen.getByRole("button", { name: en.contact.send }));
}

describe("ContactForm — el mensaje sale de verdad", () => {
  it("manda nombre, correo y mensaje al backend", async () => {
    render(<ContactForm />);
    llenar();
    enviar();
    await waitFor(() => expect(sendContactApi).toHaveBeenCalledTimes(1));
    expect(sendContactApi).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Ana Ruiz",
        email: "ana@hotelito.com",
        message: "Quiero una demo.",
      })
    );
  });

  it("avisa del exito en la pagina, sin alert", async () => {
    const alerta = vi.spyOn(window, "alert").mockImplementation(() => {});
    render(<ContactForm />);
    llenar();
    enviar();
    await waitFor(() =>
      expect(screen.getByText(en.contact.success)).toBeInTheDocument()
    );
    expect(alerta).not.toHaveBeenCalled();
    alerta.mockRestore();
  });

  it("no manda nada si el correo esta vacio", async () => {
    render(<ContactForm />);
    llenar({ correo: "" });
    enviar();
    await waitFor(() =>
      expect(screen.getByText(en.contact.emailRequired)).toBeInTheDocument()
    );
    expect(sendContactApi).not.toHaveBeenCalled();
  });

  it("no manda nada si el correo esta mal formado", async () => {
    render(<ContactForm />);
    llenar({ correo: "no-es-un-correo" });
    enviar();
    await waitFor(() =>
      expect(screen.getByText(en.contact.emailInvalid)).toBeInTheDocument()
    );
    expect(sendContactApi).not.toHaveBeenCalled();
  });

  it("si el backend falla lo dice, y NO dice que se envio", async () => {
    sendContactApi.mockRejectedValue(new Error("boom"));
    render(<ContactForm />);
    llenar();
    enviar();
    await waitFor(() =>
      expect(screen.getByText(en.contact.errSend)).toBeInTheDocument()
    );
    expect(screen.queryByText(en.contact.success)).not.toBeInTheDocument();
  });

  it("dos clics mandan una sola vez", async () => {
    let resolver;
    sendContactApi.mockImplementation(
      () => new Promise((r) => { resolver = r; })
    );
    render(<ContactForm />);
    llenar();
    // El mismo elemento, dos veces: tras el primer clic el boton cambia su
    // texto a "Sending...", asi que buscarlo otra vez por nombre no lo halla.
    const boton = screen.getByRole("button", { name: en.contact.send });
    fireEvent.click(boton);
    fireEvent.click(boton);
    await waitFor(() => expect(sendContactApi).toHaveBeenCalledTimes(1));
    resolver({ sent: true });
  });

  it("limpia los campos tras enviar, para no reenviar lo mismo", async () => {
    render(<ContactForm />);
    llenar();
    enviar();
    await waitFor(() =>
      expect(screen.getByText(en.contact.success)).toBeInTheDocument()
    );
    expect(screen.getByLabelText(/email/i)).toHaveValue("");
  });
});

describe("ContactForm — lo que se quito", () => {
  it("ya no afirma estar protegido por Google reCAPTCHA", () => {
    render(<ContactForm />);
    expect(screen.queryByText(/reCAPTCHA/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/policies\.google\.com/i)
    ).not.toBeInTheDocument();
  });

  it("ya no hay casilla de 'no soy un robot'", () => {
    render(<ContactForm />);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("el boton de enviar esta habilitado sin marcar nada", () => {
    render(<ContactForm />);
    expect(
      screen.getByRole("button", { name: en.contact.send })
    ).toBeEnabled();
  });
});

describe("ContactForm — el campo trampa", () => {
  it("existe, se manda, y no lo ve ni alcanza una persona", async () => {
    render(<ContactForm />);
    const trampa = document.querySelector('input[name="website"]');
    expect(trampa).not.toBeNull();
    // Fuera del recorrido con Tab y oculto para lectores de pantalla: una
    // persona no puede llenarlo, un bot que rellena todo sí.
    expect(trampa).toHaveAttribute("tabindex", "-1");
    expect(trampa.closest("[aria-hidden='true']")).not.toBeNull();

    llenar();
    enviar();
    await waitFor(() => expect(sendContactApi).toHaveBeenCalledTimes(1));
    expect(sendContactApi).toHaveBeenCalledWith(
      expect.objectContaining({ website: "" })
    );
  });
});
