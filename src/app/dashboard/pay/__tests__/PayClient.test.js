import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent, within } from "@testing-library/react";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

const isAuthenticated = vi.fn();
vi.mock("../../../../lib/session", () => ({
  isAuthenticated: (...a) => isAuthenticated(...a),
  getAccessToken: () => "token",
}));

const getMiEstadoDePago = vi.fn();
const iniciarCheckout = vi.fn();
const abrirPortal = vi.fn();
const autorizarCupos = vi.fn();
const getEmpresasDePago = vi.fn();
const crearEmpresa = vi.fn();
const asignarPlan = vi.fn();
const getCatalogoDeMembresia = vi.fn();
const guardarCatalogoDeMembresia = vi.fn();
vi.mock("../../../../lib/api", () => ({
  getMiEstadoDePago: (...a) => getMiEstadoDePago(...a),
  iniciarCheckout: (...a) => iniciarCheckout(...a),
  abrirPortal: (...a) => abrirPortal(...a),
  autorizarCupos: (...a) => autorizarCupos(...a),
  getEmpresasDePago: (...a) => getEmpresasDePago(...a),
  crearEmpresa: (...a) => crearEmpresa(...a),
  asignarPlan: (...a) => asignarPlan(...a),
  getCatalogoDeMembresia: (...a) => getCatalogoDeMembresia(...a),
  guardarCatalogoDeMembresia: (...a) => guardarCatalogoDeMembresia(...a),
}));

import PayClient from "../PayClient";

// Sin I18nProvider, useT cae al ingles de en.json: todo se asserta en ingles.

/** Lo que manda mi-estado para una empresa lista para pagar su primer mes. */
function empresa(extra = {}) {
  return {
    soy: "empresa",
    facturacion_activa: true,
    plan_code: "essential",
    precio_mensual_usd: 299,
    cupos_incluidos: 10,
    cupos_extra: 0,
    miembros: 7,
    cupos_extra_necesarios: 0,
    cupos_extra_maximo: 100,
    precio_cupo_extra_usd: 4,
    puede_autorizar_cupos: false,
    estado_suscripcion: null,
    current_period_end: null,
    puede_pagar: true,
    solo_contacto: false,
    paga_implementacion: true,
    tiene_portal: false,
    ...extra,
  };
}

/**
 * Lo que manda mi-estado para un INDIVIDUO (`estado_de_persona`, 10 campos). No
 * comparte ni un campo de cupos con la forma de empresa: una membresia es de una
 * persona.
 *
 * `plan_code` es el plan REAL de la fila del espejo y es `null` cuando no hay
 * fila: antes era la constante del plan que se vende y decia "membership"
 * incluso para quien no tiene nada. `membresia_viva` y `plan_ajeno` son los dos
 * booleanos con los que se separan los dos casos que llegaban identicos.
 */
function individuo(extra = {}) {
  return {
    soy: "individuo",
    facturacion_activa: true,
    plan_code: null,
    precio_mensual_usd: 29,
    estado_suscripcion: null,
    membresia_viva: false,
    plan_ajeno: false,
    puede_pagar: true,
    tiene_portal: false,
    cursos_en_el_catalogo: 4,
    ...extra,
  };
}

/** Una empresa con la suscripcion viva. */
function viva(extra = {}) {
  return empresa({
    estado_suscripcion: "active",
    current_period_end: "2026-12-11T00:00:00+00:00",
    puede_pagar: false,
    paga_implementacion: false,
    tiene_portal: true,
    ...extra,
  });
}

function fila(extra = {}) {
  return {
    comp_id: 1,
    comp_name: "Hotel Sol",
    comp_city: "Cali",
    plan_code: null,
    precio_mensual_usd: null,
    estado_suscripcion: null,
    suscripcion_viva: false,
    current_period_end: null,
    miembros: 4,
    cupos_incluidos: null,
    cupos_extra_facturados: 0,
    cupos_extra_necesarios: 0,
    admin_email: "jefe@hotel.com",
    que_falta: "sin_plan",
    ...extra,
  };
}

const realLocation = window.location;
let locationFalso;

beforeEach(() => {
  isAuthenticated.mockReturnValue(true);
  locationFalso = { href: "http://localhost/dashboard/pay", search: "" };
  Object.defineProperty(window, "location", { value: locationFalso, writable: true, configurable: true });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  getMiEstadoDePago.mockReset();
  iniciarCheckout.mockReset();
  abrirPortal.mockReset();
  autorizarCupos.mockReset();
  getEmpresasDePago.mockReset();
  crearEmpresa.mockReset();
  asignarPlan.mockReset();
  getCatalogoDeMembresia.mockReset();
  guardarCatalogoDeMembresia.mockReset();
  Object.defineProperty(window, "location", { value: realLocation, writable: true, configurable: true });
});

async function conEstado(estado, props = {}) {
  getMiEstadoDePago.mockResolvedValue(estado);
  render(<PayClient {...props} />);
  await waitFor(() => expect(getMiEstadoDePago).toHaveBeenCalled());
}

describe("panel de empresa (soy: empresa)", () => {
  it("muestra el plan, el precio y los miembros que manda el backend", async () => {
    await conEstado(empresa());
    expect(await screen.findByText(/Essential/)).toBeTruthy();
    expect(screen.getByText(/\$299/)).toBeTruthy();
    expect(screen.getByText(/7 members/i)).toBeTruthy();
    expect(screen.getByText(/10 seats included/i)).toBeTruthy();
  });

  it("el primer pago avisa que incluye la cuota de implementacion", async () => {
    await conEstado(empresa({ paga_implementacion: true }));
    expect(await screen.findByText(/one-time implementation fee/i)).toBeTruthy();
  });

  it("no avisa de la cuota de implementacion si ya la pago", async () => {
    await conEstado(empresa({ paga_implementacion: false }));
    await screen.findByRole("button", { name: /^pay/i });
    expect(screen.queryByText(/one-time implementation fee/i)).toBeNull();
  });

  it("sin plan asignado no muestra boton de pagar, dice que lo asigna Distinct", async () => {
    await conEstado(empresa({ plan_code: null, precio_mensual_usd: null, cupos_incluidos: null, puede_pagar: false }));
    expect(await screen.findByText(/Distinct assigns it/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^pay/i })).toBeNull();
  });

  it("Enterprise muestra contacto en vez de boton de pagar", async () => {
    await conEstado(empresa({
      plan_code: "enterprise", precio_mensual_usd: null, cupos_incluidos: null,
      puede_pagar: false, solo_contacto: true,
    }));
    expect(await screen.findByRole("button", { name: /contact/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^pay/i })).toBeNull();
  });

  it("con suscripcion activa muestra el estado y el boton del portal, no el de pagar", async () => {
    await conEstado(viva());
    expect(await screen.findByText(/status: active/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /manage billing/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^pay/i })).toBeNull();
  });

  it("al pagar manda al navegador a la url que devolvio el backend", async () => {
    iniciarCheckout.mockResolvedValue({ url: "https://checkout.stripe.com/c/pay/abc" });
    await conEstado(empresa());
    fireEvent.click(await screen.findByRole("button", { name: /^pay/i }));
    await waitFor(() => expect(locationFalso.href).toBe("https://checkout.stripe.com/c/pay/abc"));
  });

  // Este test lleva la mitad de pantalla del guardarraíl contra el cobro doble;
  // la otra mitad son el 409 y el candado de 60 s del backend (billing_views.py).
  it("el boton se desactiva mientras la peticion esta en curso", async () => {
    // Una promesa que nunca resuelve: la peticion queda en vuelo.
    iniciarCheckout.mockReturnValue(new Promise(() => {}));
    await conEstado(empresa());
    const boton = await screen.findByRole("button", { name: /^pay/i });
    expect(boton).not.toBeDisabled();
    fireEvent.click(boton);
    await waitFor(() => expect(boton).toBeDisabled());
  });

  it("si el backend falla muestra un error con reintentar y no deja el boton girando", async () => {
    iniciarCheckout.mockRejectedValueOnce(Object.assign(new Error("boom"), { status: 503 }));
    await conEstado(empresa());
    fireEvent.click(await screen.findByRole("button", { name: /^pay/i }));
    const alerta = await screen.findByRole("alert");
    // Un fallo de red no dice nada sobre si hubo cobro: la pantalla no lo afirma.
    expect(alerta.textContent).not.toMatch(/charged|cobr/i);
    const reintentar = screen.getByRole("button", { name: /try again/i });
    expect(reintentar).not.toBeDisabled();
    iniciarCheckout.mockResolvedValue({ url: "https://checkout.stripe.com/otra" });
    fireEvent.click(reintentar);
    await waitFor(() => expect(locationFalso.href).toBe("https://checkout.stripe.com/otra"));
  });

  /** Suscripcion viva con 13 miembros y 10 incluidos: faltan 3 cupos a $4. */
  function conCuposPorAutorizar(extra = {}) {
    return viva({
      miembros: 13, cupos_incluidos: 10, cupos_extra: 0,
      cupos_extra_necesarios: 3, precio_cupo_extra_usd: 4, puede_autorizar_cupos: true,
      ...extra,
    });
  }

  it("ofrece autorizar los cupos extra y dice cuanto cuestan ANTES de pulsar", async () => {
    await conEstado(conCuposPorAutorizar());
    expect(await screen.findByText(/3 more than your plan includes/i)).toBeTruthy();
    // 3 cupos a $4: el monto sale de los datos del backend, antes de cualquier clic.
    expect(screen.getByText(/3 extra seats at \$4 each: \$12 \/ month/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /authorize 3 extra seats/i })).toBeTruthy();
    expect(autorizarCupos).not.toHaveBeenCalled();
  });

  it("no ofrece cupos si el backend dice que no se pueden autorizar, aunque sobren miembros", async () => {
    await conEstado(conCuposPorAutorizar({ puede_autorizar_cupos: false }));
    await screen.findByRole("button", { name: /manage billing/i });
    expect(screen.queryByRole("button", { name: /authorize/i })).toBeNull();
  });

  it("al autorizar cupos manda la cantidad TOTAL que dice el backend, no la diferencia", async () => {
    // Ya tiene 2 extra facturados y el backend dice que hacen falta 3 en total.
    autorizarCupos.mockResolvedValue({ cupos_extra: 3, precio_cupos_usd: 12 });
    await conEstado(conCuposPorAutorizar({ cupos_extra: 2 }));
    fireEvent.click(await screen.findByRole("button", { name: /authorize 3 extra seats/i }));
    await waitFor(() => expect(autorizarCupos).toHaveBeenCalledWith(3));
  });

  it("tras autorizar confirma el monto que devolvio el backend", async () => {
    autorizarCupos.mockResolvedValue({ cupos_extra: 3, precio_cupos_usd: 12 });
    await conEstado(conCuposPorAutorizar());
    fireEvent.click(await screen.findByRole("button", { name: /authorize 3 extra seats/i }));
    expect(await screen.findByText(/3 extra seats authorized\. Extra seats cost \$12/i)).toBeTruthy();
  });

  it("si la autorizacion se hizo pero el refresco falla, lo dice y NO afirma que no se cobro", async () => {
    autorizarCupos.mockResolvedValue({ cupos_extra: 3, precio_cupos_usd: 12 });
    await conEstado(conCuposPorAutorizar());
    getMiEstadoDePago.mockRejectedValue(Object.assign(new Error("x"), { status: 500 }));
    fireEvent.click(await screen.findByRole("button", { name: /authorize 3 extra seats/i }));
    expect(await screen.findByText(/3 extra seats authorized\. Extra seats cost \$12/i)).toBeTruthy();
    expect(await screen.findByText(/could not refresh this screen/i)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/nothing was charged|no se cobr/i);
  });

  it("una empresa justo al tope (nada pendiente) puede elegir cuantos cupos extra quiere", async () => {
    // necesarios = 0 y ya paga 2: el valor inicial es 3 (los ya pagados + 1).
    autorizarCupos.mockResolvedValue({ cupos_extra: 3, precio_cupos_usd: 12 });
    await conEstado(viva({
      miembros: 12, cupos_incluidos: 10, cupos_extra: 2,
      cupos_extra_necesarios: 0, precio_cupo_extra_usd: 4, puede_autorizar_cupos: true,
    }));
    const campo = await screen.findByLabelText(/extra seats you want in total/i);
    expect(campo.value).toBe("3");
    // El costo mensual se ve ANTES de cualquier clic de confirmacion.
    expect(screen.getByText(/3 extra seats at \$4 each: \$12 \/ month/i)).toBeTruthy();
    expect(autorizarCupos).not.toHaveBeenCalled();
    fireEvent.change(campo, { target: { value: "5" } });
    expect(screen.getByText(/5 extra seats at \$4 each: \$20 \/ month/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /authorize 5 extra seats/i }));
    // Se manda el TOTAL (5), nunca la diferencia con lo ya facturado (3).
    await waitFor(() => expect(autorizarCupos).toHaveBeenCalledWith(5));
  });

  it("sin cupos extra y al tope, el valor inicial es 1", async () => {
    await conEstado(viva({
      miembros: 10, cupos_incluidos: 10, cupos_extra: 0,
      cupos_extra_necesarios: 0, precio_cupo_extra_usd: 4, puede_autorizar_cupos: true,
    }));
    expect((await screen.findByLabelText(/extra seats you want in total/i)).value).toBe("1");
  });

  it("el campo respeta el maximo que informa el backend y no deja confirmar por encima", async () => {
    await conEstado(conCuposPorAutorizar({ cupos_extra_maximo: 103 }));
    const campo = await screen.findByLabelText(/extra seats you want in total/i);
    expect(campo.getAttribute("max")).toBe("103");
    fireEvent.change(campo, { target: { value: "103" } });
    expect(screen.getByRole("button", { name: /authorize 103 extra seats/i })).not.toBeDisabled();
    fireEvent.change(campo, { target: { value: "104" } });
    expect(screen.getByRole("button", { name: /authorize|lower|keep/i })).toBeDisabled();
    expect(autorizarCupos).not.toHaveBeenCalled();
  });

  it("si el numero baja lo facturado, el boton dice que reduce y no que autoriza", async () => {
    autorizarCupos.mockResolvedValue({ cupos_extra: 2, precio_cupos_usd: 8 });
    await conEstado(viva({
      miembros: 12, cupos_incluidos: 10, cupos_extra: 5,
      cupos_extra_necesarios: 2, precio_cupo_extra_usd: 4, puede_autorizar_cupos: true,
    }));
    const campo = await screen.findByLabelText(/extra seats you want in total/i);
    fireEvent.change(campo, { target: { value: "3" } });
    expect(screen.queryByRole("button", { name: /authorize/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /lower to 3 extra seats/i }));
    await waitFor(() => expect(autorizarCupos).toHaveBeenCalledWith(3));
  });

  it("si el numero iguala lo facturado, el boton dice que lo mantiene", async () => {
    await conEstado(viva({
      miembros: 12, cupos_incluidos: 10, cupos_extra: 5,
      cupos_extra_necesarios: 2, precio_cupo_extra_usd: 4, puede_autorizar_cupos: true,
    }));
    const campo = await screen.findByLabelText(/extra seats you want in total/i);
    fireEvent.change(campo, { target: { value: "5" } });
    expect(screen.getByRole("button", { name: /keep 5 extra seats/i })).toBeTruthy();
  });

  it("no deja autorizar menos de lo que el backend dice que hace falta", async () => {
    await conEstado(conCuposPorAutorizar());
    const campo = await screen.findByLabelText(/extra seats you want in total/i);
    fireEvent.change(campo, { target: { value: "2" } });
    expect(screen.getByRole("button", { name: /authorize/i })).toBeDisabled();
    fireEvent.change(campo, { target: { value: "" } });
    expect(screen.getByRole("button", { name: /authorize/i })).toBeDisabled();
    expect(autorizarCupos).not.toHaveBeenCalled();
  });

  it("no ofrece cupos cuando los miembros caben", async () => {
    await conEstado(viva({ miembros: 7, cupos_incluidos: 10 }));
    await screen.findByRole("button", { name: /manage billing/i });
    expect(screen.queryByRole("button", { name: /authorize/i })).toBeNull();
  });

  it("sin puede_pagar no hay boton de pagar aunque tenga plan y ninguna suscripcion", async () => {
    // Si la pantalla derivara el boton de estado_suscripcion === null, aparecería.
    await conEstado(empresa({ puede_pagar: false, estado_suscripcion: null }));
    expect(await screen.findByText(/Essential/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^pay/i })).toBeNull();
  });

  it("sin tiene_portal no hay boton del portal aunque haya estado de suscripcion", async () => {
    await conEstado(viva({ tiene_portal: false }));
    expect(await screen.findByText(/status: active/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /manage billing/i })).toBeNull();
  });

  it("si el backend no devuelve url no navega a undefined y deja reintentar", async () => {
    iniciarCheckout.mockResolvedValue({});
    await conEstado(empresa());
    fireEvent.click(await screen.findByRole("button", { name: /^pay/i }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(locationFalso.href).toBe("http://localhost/dashboard/pay");
    expect(screen.getByRole("button", { name: /try again/i })).not.toBeDisabled();
  });

  it("abre el portal con la url que devolvio el backend", async () => {
    abrirPortal.mockResolvedValue({ url: "https://billing.stripe.com/p/xyz" });
    await conEstado(viva());
    fireEvent.click(await screen.findByRole("button", { name: /manage billing/i }));
    await waitFor(() => expect(locationFalso.href).toBe("https://billing.stripe.com/p/xyz"));
  });
});

describe("regreso de Stripe (?pago=)", () => {
  it("pago=ok no afirma que el plan este activo y no deja pagar otra vez", async () => {
    await conEstado(empresa(), { pago: "ok" });
    expect(await screen.findByText(/payment received/i)).toBeTruthy();
    expect(screen.getByText(/will appear in a moment/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^pay/i })).toBeNull();
    expect(screen.getByRole("button", { name: /check again/i })).toBeTruthy();
  });

  it("pago=ok desaparece cuando el plan ya aparecio", async () => {
    await conEstado(viva(), { pago: "ok" });
    await screen.findByRole("button", { name: /manage billing/i });
    expect(screen.queryByText(/payment received/i)).toBeNull();
  });

  it("pago=cancelado lo dice y deja volver a pagar", async () => {
    await conEstado(empresa(), { pago: "cancelado" });
    expect(await screen.findByText(/payment was cancelled/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /^pay/i })).toBeTruthy();
  });

  it("sin parametro no pinta ningun aviso de pago", async () => {
    await conEstado(empresa());
    await screen.findByRole("button", { name: /^pay/i });
    expect(screen.queryByText(/payment received|payment was cancelled/i)).toBeNull();
  });
});

describe("carga de mi-estado", () => {
  it("si falla muestra error con reintentar", async () => {
    getMiEstadoDePago.mockRejectedValueOnce(Object.assign(new Error("x"), { status: 500 }));
    render(<PayClient />);
    const reintentar = await screen.findByRole("button", { name: /try again/i });
    getMiEstadoDePago.mockResolvedValue(empresa());
    fireEvent.click(reintentar);
    expect(await screen.findByText(/Essential/)).toBeTruthy();
  });

  it("el fallo de carga NUNCA afirma que no se cobro (un GET fallido no dice nada del cargo)", async () => {
    getMiEstadoDePago.mockRejectedValueOnce(Object.assign(new Error("x"), { status: 500 }));
    render(<PayClient />);
    const alerta = await screen.findByRole("alert");
    expect(alerta.textContent).not.toMatch(/charged|cobr/i);
  });

  it("?pago=ok con mi-estado fallando no dice que no se cobro y avisa que el pago esta en Stripe", async () => {
    // Stripe redirige aqui un instante despues de cobrar; la pagina puede estar fria.
    getMiEstadoDePago.mockRejectedValueOnce(Object.assign(new Error("x"), { status: 503 }));
    render(<PayClient pago="ok" />);
    const alerta = await screen.findByRole("alert");
    expect(document.body.textContent).not.toMatch(/nothing has been charged|no se ha cobrado/i);
    expect(document.body.textContent).toMatch(/payment went through to Stripe/i);
    expect(document.body.textContent).toMatch(/confirmed/i);
    expect(alerta).toBeTruthy();
    expect(screen.getByRole("button", { name: /try again/i })).toBeTruthy();
  });

  it("un 401 manda a iniciar sesion, no a reintentar", async () => {
    getMiEstadoDePago.mockRejectedValueOnce(Object.assign(new Error("x"), { status: 401 }));
    render(<PayClient />);
    expect(await screen.findByRole("button", { name: /sign in/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /try again/i })).toBeNull();
  });

  it("sin sesion redirige a login sin pedir nada", async () => {
    isAuthenticated.mockReturnValue(false);
    render(<PayClient />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login?next=/dashboard/pay"));
    expect(getMiEstadoDePago).not.toHaveBeenCalled();
  });
});

describe("consola (soy: admin_distinct)", () => {
  async function consola(empresas, planes = ["essential", "performance", "enterprise"]) {
    getEmpresasDePago.mockResolvedValue({ empresas, planes_asignables: planes });
    // La consola monta tambien el catalogo de la membresia (CatalogPicker).
    getCatalogoDeMembresia.mockResolvedValue({
      cursos: [{ moodle_course_id: 12, nombre: "Bartender", categoria: "BARTENDER", categoria_codigo: null, visible: true, incluido: true }],
      incluidos: 1,
      incluidos_sin_curso_en_moodle: [],
      incluidos_ocultos_en_moodle: [],
    });
    await conEstado({ soy: "admin_distinct", facturacion_activa: true });
  }

  it("lista las empresas con su columna de que falta", async () => {
    await consola([
      fila(),
      fila({ comp_id: 2, comp_name: "Hotel Luna", plan_code: "essential", que_falta: "sin_pagar", admin_email: "luna@hotel.com" }),
    ]);
    const tabla = await screen.findByRole("table");
    expect(within(tabla).getByText("Hotel Sol")).toBeTruthy();
    expect(within(tabla).getByText("Hotel Luna")).toBeTruthy();
    expect(within(tabla).getByText(/no plan assigned/i)).toBeTruthy();
    expect(within(tabla).getByText(/waiting for payment/i)).toBeTruthy();
  });

  it("permite asignar el plan a una empresa y refresca la fila", async () => {
    asignarPlan.mockResolvedValue(fila({ plan_code: "performance", que_falta: "sin_pagar" }));
    await consola([fila()]);
    await screen.findByRole("table");
    fireEvent.change(screen.getByLabelText(/plan for hotel sol/i), { target: { value: "performance" } });
    fireEvent.click(screen.getByRole("button", { name: /assign plan/i }));
    await waitFor(() => expect(asignarPlan).toHaveBeenCalledWith(1, { comp_plan_code: "performance" }));
    expect(await screen.findByText(/waiting for payment/i)).toBeTruthy();
    expect(screen.queryByText(/no plan assigned/i)).toBeNull();
  });

  it("con suscripcion viva avisa que el plan asignado surte efecto en la proxima suscripcion", async () => {
    await consola([fila({ plan_code: "essential", estado_suscripcion: "active", suscripcion_viva: true }), fila({ comp_id: 2, comp_name: "Hotel Luna" })]);
    await screen.findByRole("table");
    // Solo la fila con suscripcion viva lleva la nota.
    expect(screen.getAllByText(/takes effect on its next subscription/i)).toHaveLength(1);
  });

  it("la nota depende del booleano del backend, no del estado: una suscripcion cancelada no la lleva", async () => {
    await consola([fila({ plan_code: "essential", estado_suscripcion: "canceled", suscripcion_viva: false })]);
    await screen.findByRole("table");
    expect(screen.queryByText(/takes effect on its next subscription/i)).toBeNull();
  });

  it("el selector ofrece los planes que manda el backend y ninguno mas", async () => {
    await consola([fila()], ["essential", "platinum"]);
    const selector = await screen.findByLabelText(/plan for hotel sol/i);
    const opciones = within(selector).getAllByRole("option").map((o) => o.value).filter(Boolean);
    expect(opciones).toEqual(["essential", "platinum"]);
  });

  it("el formulario de crear empresa exige el id de categoria de Moodle", async () => {
    await consola([]);
    await screen.findByRole("table");
    fireEvent.change(screen.getByLabelText(/company name/i), { target: { value: "Hotel Nuevo" } });
    fireEvent.click(screen.getByRole("button", { name: /create company/i }));
    expect(crearEmpresa).not.toHaveBeenCalled();
    expect(await screen.findByText(/moodle category id is required/i)).toBeTruthy();

    crearEmpresa.mockResolvedValue(fila({ comp_id: 9, comp_name: "Hotel Nuevo" }));
    fireEvent.change(screen.getByLabelText(/moodle category id/i), { target: { value: "42" } });
    fireEvent.click(screen.getByRole("button", { name: /create company/i }));
    await waitFor(() => expect(crearEmpresa).toHaveBeenCalledWith(
      expect.objectContaining({ comp_name: "Hotel Nuevo", moodle_categories_id: 42 }),
    ));
    expect(await screen.findByText("Hotel Nuevo", { selector: "td" })).toBeTruthy();
  });

  it("muestra el aviso de cupos sin facturar de una empresa", async () => {
    await consola([fila({
      plan_code: "essential", que_falta: "cupos_sin_facturar",
      cupos_extra_necesarios: 5, cupos_extra_facturados: 2,
    })]);
    expect(await screen.findByText(/5 extra seats needed, 2 billed/i)).toBeTruthy();
  });

  it("la consola monta tambien el catalogo de la membresia", async () => {
    await consola([fila()]);
    expect(await screen.findByRole("checkbox", { name: /bartender/i })).toBeTruthy();
  });

  it("la consola no pinta botones de pagar", async () => {
    await consola([fila()]);
    await screen.findByRole("table");
    expect(screen.queryByRole("button", { name: /^pay/i })).toBeNull();
    expect(iniciarCheckout).not.toHaveBeenCalled();
  });
});

describe("panel del individuo (soy: individuo)", () => {
  it("muestra el precio que vino de Stripe y cuantos cursos incluye", async () => {
    await conEstado(individuo());
    expect(await screen.findByText(/\$29 \/ month/i)).toBeTruthy();
    expect(screen.getByText(/4 courses included/i)).toBeTruthy();
  });

  it("sin precio disponible no ofrece pagar y explica por que", async () => {
    // `precio_mensual_usd: null` = Stripe no respondio el precio. No se inventa
    // un numero que la tarjeta no va a cumplir.
    await conEstado(individuo({ precio_mensual_usd: null, puede_pagar: false }));
    expect(await screen.findByText(/could not read the price/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /get the membership/i })).toBeNull();
    expect(document.body.textContent).not.toMatch(/\$null|\$undefined/);
  });

  it("al pagar manda al navegador a la url que devolvio el backend", async () => {
    iniciarCheckout.mockResolvedValue({ url: "https://checkout.stripe.com/c/pay/mem" });
    await conEstado(individuo());
    fireEvent.click(await screen.findByRole("button", { name: /get the membership/i }));
    await waitFor(() => expect(locationFalso.href).toBe("https://checkout.stripe.com/c/pay/mem"));
  });

  it("el boton se desactiva mientras la peticion esta en curso", async () => {
    iniciarCheckout.mockReturnValue(new Promise(() => {}));
    await conEstado(individuo());
    const boton = await screen.findByRole("button", { name: /get the membership/i });
    expect(boton).not.toBeDisabled();
    fireEvent.click(boton);
    await waitFor(() => expect(boton).toBeDisabled());
  });

  /** La membresia de verdad: `membresia_viva` es el booleano del backend y es lo
   *  unico que autoriza a decir que esta activa. */
  it("con membresia activa muestra el estado y el boton del portal, no el de pagar", async () => {
    await conEstado(individuo({
      plan_code: "membership", estado_suscripcion: "active", membresia_viva: true,
      puede_pagar: false, tiene_portal: true,
    }));
    expect(await screen.findByText(/status: active/i)).toBeTruthy();
    expect(screen.getByText(/your membership is active/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /manage billing/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /get the membership/i })).toBeNull();
    // Lo que NO se le dice a quien si pago: que su suscripcion es de otra cosa.
    expect(document.body.textContent).not.toMatch(/not this membership/i);
  });

  it("membresia viva con el catalogo vacio NO dice que tiene acceso: avisa que no hay cursos y que escriba", async () => {
    // Dinero cobrado por nada: el backend no corta el acceso con el catalogo
    // vacio a proposito, asi que este estado existe en produccion. La pantalla
    // tiene que decirlo, y NO puede decir que el cobro se detuvo (no se detuvo).
    await conEstado(individuo({
      plan_code: "membership", estado_suscripcion: "active", membresia_viva: true,
      puede_pagar: false, tiene_portal: true, cursos_en_el_catalogo: 0,
    }));
    expect(await screen.findByText(/membership is active, but it does not include any course right now/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /write to us/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /manage billing/i })).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/you have access to the courses/i);
    expect(document.body.textContent).not.toMatch(/stopped|no longer (be )?charg|not be charged/i);
    expect(screen.queryByRole("button", { name: /get the membership/i })).toBeNull();
  });

  it("membresia viva sin el dato del catalogo no afirma que este vacio", async () => {
    await conEstado(individuo({
      plan_code: "membership", estado_suscripcion: "active", membresia_viva: true,
      puede_pagar: false, tiene_portal: true, cursos_en_el_catalogo: undefined,
    }));
    expect(await screen.findByText(/your membership is active: you have access/i)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/does not include any course/i);
  });

  it("con un solo curso incluido dice '1 course included', no '1 courses'", async () => {
    await conEstado(individuo({ cursos_en_el_catalogo: 1 }));
    expect(await screen.findByText("1 course included")).toBeTruthy();
  });

  /**
   * El caso medido de la revision del backend: una suscripcion VIVA que no es
   * esta membresia (creada a mano en Stripe con otro precio) llega con
   * `estado_suscripcion: "active"`, `puede_pagar: false` y `tiene_portal: true`
   * Y CON EL ACCESO CORTADO (402). Se reconoce por `plan_ajeno`, que el backend
   * calcula con las mismas funciones del corte: `puede_pagar: false` tambien
   * ocurre con Stripe caido, el catalogo vacio o el interruptor apagado.
   */
  it("con un plan ajeno vivo NO dice que tenga la membresia: nombra la otra suscripcion y pide que escriba", async () => {
    await conEstado(individuo({
      plan_code: "essential", estado_suscripcion: "active", plan_ajeno: true,
      puede_pagar: false, tiene_portal: true,
    }));
    expect(await screen.findByText(/not this membership/i)).toBeTruthy();
    expect(document.body.textContent).toMatch(/twice/i);
    expect(document.body.textContent).not.toMatch(/your membership is active|you have access/i);
    // El plan que se le esta cobrando, con el nombre que ya conoce la pantalla.
    expect(screen.getByText(/Essential/)).toBeTruthy();
    // Las dos salidas: el portal y escribirnos.
    expect(screen.getByRole("button", { name: /manage billing/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /write to us/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /get the membership/i })).toBeNull();
  });

  it("un plan ajeno sin plan reconocible no inventa ningun nombre de plan", async () => {
    // `plan_code: null` = el precio de Stripe no tiene un lookup key conocido.
    await conEstado(individuo({
      plan_code: null, estado_suscripcion: "active", plan_ajeno: true,
      puede_pagar: false, tiene_portal: true,
    }));
    expect(await screen.findByText(/not this membership/i)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/plan being charged|null|undefined/i);
  });

  /**
   * Una membresia CANCELADA no cobra, asi que el backend manda
   * `estado_suscripcion: "canceled"` CON `puede_pagar: true`: quien la cancelo
   * puede volver. La pantalla sigue a ese booleano y no deduce de "hay estado
   * de suscripcion" que no se pueda comprar.
   */
  it("con la suscripcion cancelada muestra el estado y DEJA volver a contratar", async () => {
    await conEstado(individuo({
      plan_code: "membership", estado_suscripcion: "canceled",
      membresia_viva: false, plan_ajeno: false, puede_pagar: true, tiene_portal: true,
    }));
    expect(await screen.findByText(/status: cancelled/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /get the membership/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /manage billing/i })).toBeTruthy();
    // Ni activa ni plan ajeno: una fila muerta no es ninguna de las dos cosas.
    expect(document.body.textContent).not.toMatch(/your membership is active|not this membership/i);
  });

  it("con la membresia apagada no pinta nada que cobre", async () => {
    // `facturacion_activa: false` apaga el espejo entero.
    await conEstado(individuo({ facturacion_activa: false, precio_mensual_usd: null, puede_pagar: false }));
    expect(await screen.findByText(/payments are not enabled/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /get the membership|manage billing/i })).toBeNull();
  });

  it("con la venta apagada pero la facturacion encendida tampoco ofrece pagar", async () => {
    // MEMBERSHIP_ENABLED apagado: el backend manda `puede_pagar: false` con
    // precio y catalogo. La pantalla sigue al booleano, no lo recalcula.
    await conEstado(individuo({ puede_pagar: false }));
    expect(await screen.findByText(/cannot be purchased from this account/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /get the membership/i })).toBeNull();
  });

  it("si el catalogo esta vacio avisa que todavia no hay cursos incluidos", async () => {
    await conEstado(individuo({ cursos_en_el_catalogo: 0, puede_pagar: false }));
    expect(await screen.findByText(/does not include any course yet/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /get the membership/i })).toBeNull();
  });

  it("un 409 por membresia viva dice que ya la tiene, no que haya otra suscripcion", async () => {
    // Se distingue por el campo `motivo`, NUNCA por el texto del backend.
    iniciarCheckout.mockRejectedValueOnce(Object.assign(new Error("x"), {
      status: 409, motivo: "membresia_viva",
    }));
    await conEstado(individuo());
    fireEvent.click(await screen.findByRole("button", { name: /get the membership/i }));
    const alerta = await screen.findByRole("alert");
    expect(alerta.textContent).toMatch(/already have a membership/i);
    expect(alerta.textContent).not.toMatch(/twice/i);
  });

  it("un 409 por plan ajeno dice que hay otra suscripcion y que escriba, no que ya la tiene", async () => {
    iniciarCheckout.mockRejectedValueOnce(Object.assign(new Error("x"), {
      status: 409, motivo: "plan_ajeno",
    }));
    await conEstado(individuo());
    fireEvent.click(await screen.findByRole("button", { name: /get the membership/i }));
    const alerta = await screen.findByRole("alert");
    expect(alerta.textContent).toMatch(/not this membership/i);
    expect(alerta.textContent).toMatch(/twice/i);
    expect(alerta.textContent).not.toMatch(/already have a membership/i);
  });

  it("un 409 sin motivo es el pago en curso: ni 'ya la tienes' ni 'plan ajeno'", async () => {
    iniciarCheckout.mockRejectedValueOnce(Object.assign(new Error("x"), { status: 409 }));
    await conEstado(individuo());
    fireEvent.click(await screen.findByRole("button", { name: /get the membership/i }));
    const alerta = await screen.findByRole("alert");
    expect(alerta.textContent).toMatch(/payment in progress/i);
    expect(alerta.textContent).not.toMatch(/already have a membership|twice/i);
  });

  it("un fallo al pagar no afirma nada sobre el cobro y deja reintentar", async () => {
    iniciarCheckout.mockRejectedValueOnce(Object.assign(new Error("x"), { status: 503 }));
    await conEstado(individuo());
    fireEvent.click(await screen.findByRole("button", { name: /get the membership/i }));
    const alerta = await screen.findByRole("alert");
    expect(alerta.textContent).not.toMatch(/charged|cobr/i);
    expect(screen.getByRole("button", { name: /try again/i })).not.toBeDisabled();
  });

  it("al volver de Stripe con pago=ok no afirma que la membresia este activa", async () => {
    await conEstado(individuo(), { pago: "ok" });
    expect(await screen.findByText(/payment received/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /get the membership/i })).toBeNull();
    expect(screen.getByRole("button", { name: /check again/i })).toBeTruthy();
  });

  it("el individuo nunca ve nada de cupos: una membresia no tiene asientos", async () => {
    await conEstado(individuo());
    await screen.findByRole("button", { name: /get the membership/i });
    expect(screen.queryByText(/seats/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /authorize/i })).toBeNull();
  });
});

describe("soy: nada y facturacion apagada", () => {
  it("nada: no pinta ningun boton de compra", async () => {
    await conEstado({ soy: "nada", facturacion_activa: true });
    expect(await screen.findByText(/nothing to purchase/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /pay|authorize|manage billing|assign/i })).toBeNull();
  });

  it("con la facturacion apagada no se pinta nada que cobre", async () => {
    await conEstado(empresa({ facturacion_activa: false, puede_pagar: false }));
    expect(await screen.findByText(/payments are not enabled/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /pay|authorize|manage billing/i })).toBeNull();
  });
});
