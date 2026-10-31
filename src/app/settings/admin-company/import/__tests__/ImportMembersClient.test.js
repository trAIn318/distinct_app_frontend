import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent, within } from "@testing-library/react";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

const isAuthenticated = vi.fn();
vi.mock("../../../../../lib/session", () => ({
  isAuthenticated: (...a) => isAuthenticated(...a),
  getAccessToken: () => "token",
}));

const getImportTemplate = vi.fn();
const previewMembersImport = vi.fn();
const commitMembersImport = vi.fn();
vi.mock("../../../../../lib/api", () => ({
  getImportTemplate: (...a) => getImportTemplate(...a),
  previewMembersImport: (...a) => previewMembersImport(...a),
  commitMembersImport: (...a) => commitMembersImport(...a),
}));

import ImportMembersClient from "../ImportMembersClient";
import { IMPORT_LIMITS } from "../../../../../lib/companyAdmin";
import en from "../../../../../i18n/messages/en.json";
import es from "../../../../../i18n/messages/es.json";

// Sin I18nProvider, `useT` cae al ingles de en.json: TODA asercion de texto va
// contra el ingles.

const RUTA = "/settings/admin-company/import";

/** Un csv valido. El tamano se controla con el contenido. */
function csv(contenido = "correo,nombre,apellido\na@x.com,Ana,Gil\n", nombre = "equipo.csv") {
  return new File([contenido], nombre, { type: "text/csv" });
}

/** Las SEIS categorias con su conteo, como las devuelve `_zero_counts()`. */
function conteos(extra = {}) {
  return {
    invite: 0, join: 0, already: 0, rejected: 0, invalid: 0, error: 0, ...extra,
  };
}

/** Respuesta de POST /import/preview/ */
function previa({ rows = [], counts = {}, total } = {}) {
  return {
    total: total === undefined ? rows.length : total,
    counts: conteos(counts),
    rows,
  };
}

/** Respuesta de POST /import/ */
function resultado({ rows = [], counts = {}, total, invitations_issued = 0, email_failed = 0 } = {}) {
  return {
    total: total === undefined ? rows.length : total,
    counts: conteos(counts),
    rows,
    invitations_issued,
    email_failed,
    // El backend lo devuelve SIEMPRE en falso: la carga no mete a nadie en la
    // empresa, solo crea cuentas invitadas.
    membership_changed: false,
  };
}

/** Una promesa que se resuelve cuando se le dice. */
function diferida() {
  let resolver;
  const promesa = new Promise((res) => { resolver = res; });
  return { promesa, resolver };
}

const CAMPO_ARCHIVO = /your file/i;
const BOTON_PREVIA = { name: /see what would happen/i };
const BOTON_CONFIRMAR = { name: /^import these people$/i };

function campoArchivo() {
  return screen.getByLabelText(CAMPO_ARCHIVO);
}

/** Elige un archivo en el campo. */
function elegir(file) {
  fireEvent.change(campoArchivo(), { target: { files: [file] } });
}

/** El formulario del paso 1 (el que contiene el campo de archivo). */
function formularioDelArchivo() {
  return campoArchivo().closest("form");
}

/**
 * Pide la previsualizacion.
 *
 * Con un `submit` y no con un clic, MEDIDO y no supuesto: el campo lleva
 * `required` (claude.md 5.5), y la validacion de restricciones de jsdom no ve
 * el archivo que `fireEvent` le asigna al input -`input.files.length` vale 1 y
 * `input.validity.valueMissing` sigue siendo `true`-, asi que en jsdom un clic
 * en el boton de enviar NUNCA produce un submit. Es una limitacion del entorno
 * de pruebas, no del producto. El camino que el componente maneja es el evento
 * `submit`, y es el que se ejercita aqui; que el control sea un boton de enviar
 * DENTRO de ese formulario lo fija su propia prueba.
 */
function pedirPrevia() {
  fireEvent.submit(formularioDelArchivo());
}

/** Elige el archivo y espera a que la previsualizacion este pintada. */
async function hastaLaPrevia(file = csv()) {
  elegir(file);
  pedirPrevia();
  await waitFor(() => expect(screen.getByRole("button", BOTON_CONFIRMAR)).toBeInTheDocument());
}

/** El `<ul>` resumen, por su nombre accesible. */
function resumen(nombre) {
  return screen.getByRole("list", { name: nombre });
}

/** La fila de la tabla que contiene ese correo. */
function filaDe(correo) {
  const celda = screen.getByText(correo);
  return celda.closest("tr");
}

let urls;
let clics;

beforeEach(() => {
  replace.mockClear();
  for (const m of [isAuthenticated, getImportTemplate, previewMembersImport, commitMembersImport]) {
    m.mockReset();
  }
  isAuthenticated.mockReturnValue(true);
  getImportTemplate.mockResolvedValue("correo,nombre,apellido\r\n");
  previewMembersImport.mockResolvedValue(previa());
  commitMembersImport.mockResolvedValue(resultado());

  // jsdom no implementa ninguno de los dos, y `a.click()` sobre un blob:
  // intentaria navegar. Se capturan los blobs para poder medir QUE se descarga.
  urls = [];
  clics = [];
  globalThis.URL.createObjectURL = vi.fn((blob) => {
    urls.push(blob);
    return `blob:${urls.length}`;
  });
  globalThis.URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function espia() {
    clics.push({ href: this.getAttribute("href"), download: this.getAttribute("download") });
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("la pantalla privada", () => {
  it("sin sesion redirige a login con ?next= y no pinta nada", async () => {
    isAuthenticated.mockReturnValue(false);
    const { container } = render(<ImportMembersClient />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith(`/login?next=${RUTA}`));
    expect(container).toBeEmptyDOMElement();
    expect(previewMembersImport).not.toHaveBeenCalled();
  });

  it("en los TRES pasos no se escapa ni una ruta de clave ni una variable", async () => {
    // `makeT` pinta la ruta cruda cuando falta una clave
    // ("companyAdmin.import.algo") y deja el "{total}" tal cual cuando el
    // nombre de la variable no coincide. Las dos cosas se le verian al cliente,
    // y son un anti-objetivo explicito del diseno.
    previewMembersImport.mockResolvedValue(previa({
      total: 2, counts: { invite: 1, invalid: 1 },
      rows: [
        { row: 1, email: "uno@x.com", result: "invite" },
        { row: 2, email: "dos@x.com", result: "invalid" },
      ],
    }));
    commitMembersImport.mockResolvedValue(resultado({
      total: 2, invitations_issued: 1, email_failed: 1,
      counts: { invite: 1, invalid: 1 },
      rows: [
        { row: 1, email: "uno@x.com", result: "invite", email_sent: false },
        { row: 2, email: "dos@x.com", result: "invalid" },
      ],
    }));
    render(<ImportMembersClient />);
    await waitFor(() => expect(campoArchivo()).toBeInTheDocument());

    const limpio = (paso) => {
      const texto = document.body.textContent;
      expect(texto, paso).not.toMatch(/companyAdmin\./);
      expect(texto, paso).not.toMatch(/\{[a-zA-Z]+\}/);
      // Y que de verdad habia algo pintado, para que no se cumpla en vacio.
      expect(texto.length, paso).toBeGreaterThan(200);
    };

    limpio("paso 1");
    elegir(csv("a".repeat(1024 * 1024 + 1)));   // el rechazo lleva {maxKb}
    limpio("paso 1 con el archivo rechazado");
    await hastaLaPrevia();
    limpio("paso 2");
    fireEvent.click(screen.getByRole("button", BOTON_CONFIRMAR));
    await waitFor(() => expect(screen.getByText(/what happened/i)).toBeInTheDocument());
    limpio("el resultado");
  });

  it("en cada paso hay UN solo elemento dorado", async () => {
    // claude.md 2.1: maximo un elemento dorado por vista. `.btn-primary` es el
    // unico relleno dorado del repositorio, asi que se cuenta.
    previewMembersImport.mockResolvedValue(previa({
      total: 1, counts: { invite: 1 },
      rows: [{ row: 1, email: "uno@x.com", result: "invite" }],
    }));
    commitMembersImport.mockResolvedValue(resultado({
      total: 1, invitations_issued: 1, counts: { invite: 1 },
      rows: [{ row: 1, email: "uno@x.com", result: "invite", email_sent: true }],
    }));
    const dorados = () => document.querySelectorAll(".btn-primary").length;
    render(<ImportMembersClient />);
    await waitFor(() => expect(campoArchivo()).toBeInTheDocument());
    expect(dorados(), "paso 1").toBe(1);
    await hastaLaPrevia();
    // Los dos pasos se ven JUNTOS, asi que el dorado del paso 1 tiene que
    // haberse apagado al encenderse el de confirmar.
    expect(dorados(), "paso 1 + paso 2 a la vista").toBe(1);
    fireEvent.click(screen.getByRole("button", BOTON_CONFIRMAR));
    await waitFor(() => expect(screen.getByText(/what happened/i)).toBeInTheDocument());
    expect(dorados(), "el resultado").toBe(1);
  });

  it("dice los nombres EXACTOS de las columnas que el backend espera", async () => {
    // `_TEMPLATE_HEADER = ["correo", "nombre", "apellido"]`. Un encabezado
    // traducido hace que el parser no encuentre la columna de correo y rechace
    // el archivo entero, asi que la pantalla no puede "traducirlo".
    render(<ImportMembersClient />);
    await waitFor(() => expect(campoArchivo()).toBeInTheDocument());
    expect(screen.getByText("correo,nombre,apellido")).toBeInTheDocument();
  });
});

describe("la plantilla", () => {
  it("ofrece descargarla, y descarga el csv que dio el BACKEND", async () => {
    // El encabezado lo decide el backend (esta en espanol a proposito). Si la
    // pantalla lo inventara, el archivo que el jefe rellena no se podria leer.
    render(<ImportMembersClient />);
    await waitFor(() => expect(campoArchivo()).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /download the template/i }));
    await waitFor(() => expect(getImportTemplate).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(clics).toHaveLength(1));
    expect(clics[0].download).toMatch(/\.csv$/);
    expect(urls).toHaveLength(1);
    await expect(urls[0].text()).resolves.toBe("correo,nombre,apellido\r\n");
  });

  it("si la descarga falla lo dice, y no en silencio", async () => {
    getImportTemplate.mockRejectedValue({ status: 500 });
    render(<ImportMembersClient />);
    await waitFor(() => expect(campoArchivo()).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /download the template/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByRole("alert").textContent).toMatch(/waking up/i);
    expect(clics).toHaveLength(0);
  });
});

describe("lo que se rechaza en la pantalla, sin red", () => {
  it("un archivo que no es csv se rechaza aqui y NO se llama al backend", async () => {
    // La OTRA carga de este proyecto -analitica/propiedades- si acepta zip.
    // Esta no: `parse_members_csv` es el unico camino y no hay rama de zip.
    render(<ImportMembersClient />);
    await waitFor(() => expect(campoArchivo()).toBeInTheDocument());
    elegir(new File(["cualquier cosa"], "equipo.zip", { type: "application/zip" }));
    // Positivo primero: sin esto la asercion negativa se cumpliria con la
    // pantalla en blanco.
    expect(screen.getByText(/choose a \.csv file/i)).toBeInTheDocument();
    // Un `submit` ignora el `disabled` del boton, asi que se prueba el camino
    // que de verdad podria llegar al backend.
    fireEvent.submit(campoArchivo().closest("form"));
    await waitFor(() => expect(screen.getByText(/choose a \.csv file/i)).toBeInTheDocument());
    expect(previewMembersImport).not.toHaveBeenCalled();
    expect(commitMembersImport).not.toHaveBeenCalled();
  });

  it("un archivo de mas de 1 MB se rechaza aqui y NO se llama al backend", async () => {
    render(<ImportMembersClient />);
    await waitFor(() => expect(campoArchivo()).toBeInTheDocument());
    elegir(csv("a".repeat(1024 * 1024 + 1)));
    // El tope va DENTRO del rechazo: ahora la linea que anuncia los topes
    // tambien lo dice -los dos salen de IMPORT_LIMITS-, asi que buscar "1024
    // KB" en toda la pantalla encontraria dos elementos y no fijaria nada.
    expect(screen.getByText(/too large/i).textContent).toMatch(/1024 KB/);
    fireEvent.submit(campoArchivo().closest("form"));
    await waitFor(() => expect(screen.getByText(/too large/i)).toBeInTheDocument());
    expect(previewMembersImport).not.toHaveBeenCalled();
  });

  it("M40: un .txt que lleva 'csv' en el NOMBRE tambien se rechaza", async () => {
    // El guard es `/\.csv$/i`: la extension, no la subcadena. Las otras pruebas
    // usan "equipo.zip" y "equipo.txt", y ninguno de los dos contiene "csv",
    // asi que ninguna distinguia `/\.csv$/i` de `/csv/i`. Este nombre si.
    render(<ImportMembersClient />);
    await waitFor(() => expect(campoArchivo()).toBeInTheDocument());
    elegir(new File(["correo\na@x.com\n"], "equipo.csv.txt", { type: "text/plain" }));
    expect(screen.getByText(/choose a \.csv file/i)).toBeInTheDocument();
    // Un `submit` ignora el `disabled`, asi que se prueba el camino que de
    // verdad podria llegar al backend.
    fireEvent.submit(formularioDelArchivo());
    await waitFor(() => expect(screen.getByText(/choose a \.csv file/i)).toBeInTheDocument());
    expect(previewMembersImport).not.toHaveBeenCalled();
  });

  it("un archivo vacio se rechaza aqui y NO se llama al backend", async () => {
    render(<ImportMembersClient />);
    await waitFor(() => expect(campoArchivo()).toBeInTheDocument());
    elegir(csv(""));
    expect(screen.getByText(/that file is empty/i)).toBeInTheDocument();
    fireEvent.submit(campoArchivo().closest("form"));
    await waitFor(() => expect(screen.getByText(/that file is empty/i)).toBeInTheDocument());
    expect(previewMembersImport).not.toHaveBeenCalled();
  });

  it("el error del archivo sale DEBAJO del campo y asociado a el", async () => {
    // claude.md 5.5: nunca en alert(), siempre debajo del campo.
    render(<ImportMembersClient />);
    await waitFor(() => expect(campoArchivo()).toBeInTheDocument());
    elegir(new File(["x"], "equipo.txt", { type: "text/plain" }));
    const campo = campoArchivo();
    expect(campo).toHaveAttribute("aria-invalid", "true");
    const idError = campo.getAttribute("aria-describedby");
    expect(document.getElementById(idError).textContent).toMatch(/choose a \.csv file/i);
  });
});

describe("la previsualizacion", () => {
  it("se pide con un boton de ENVIAR dentro del formulario del archivo", async () => {
    // Lo que `pedirPrevia()` no puede comprobar por la limitacion de jsdom: que
    // el control exista, sea de tipo `submit` y viva en ESE formulario, que es
    // lo que hace que un clic lo envie en un navegador de verdad.
    render(<ImportMembersClient />);
    await waitFor(() => expect(campoArchivo()).toBeInTheDocument());
    const boton = screen.getByRole("button", BOTON_PREVIA);
    expect(boton).toHaveAttribute("type", "submit");
    expect(boton.closest("form")).toBe(formularioDelArchivo());
  });

  it("muestra las CINCO categorias con palabras del jefe y su conteo", async () => {
    previewMembersImport.mockResolvedValue(previa({
      total: 20,
      counts: { invite: 2, join: 3, already: 4, rejected: 5, invalid: 6 },
      rows: [{ row: 1, email: "a@x.com", result: "invite" }],
    }));
    render(<ImportMembersClient />);
    await waitFor(() => expect(campoArchivo()).toBeInTheDocument());
    await hastaLaPrevia();

    const lista = resumen(/what would happen, by outcome/i);
    // Los conteos son los cinco distintos a proposito: asi una etiqueta
    // emparejada con el numero de otra categoria se nota.
    const esperado = [
      [/^Will be invited$/, "2"],
      [/^Will be invited to join$/, "3"],
      [/^Already on your team$/, "4"],
      [/^Cannot be added$/, "5"],
      [/^Invalid row/, "6"],
    ];
    for (const [etiqueta, conteo] of esperado) {
      const fila = within(lista).getByText(etiqueta).closest("li");
      expect(fila.textContent).toContain(conteo);
    }
  });

  it("M58: pinta tambien los CEROS de las categorias que no tocan a nadie", async () => {
    // Saber que ninguna fila va a quedar fuera es parte de lo que el jefe viene
    // a comprobar: una categoria en cero tiene que decir "0", no desaparecer.
    previewMembersImport.mockResolvedValue(previa({
      total: 2,
      counts: { invite: 2 },
      rows: [
        { row: 1, email: "uno@x.com", result: "invite" },
        { row: 2, email: "dos@x.com", result: "invite" },
      ],
    }));
    render(<ImportMembersClient />);
    await waitFor(() => expect(campoArchivo()).toBeInTheDocument());
    await hastaLaPrevia();

    const lista = resumen(/what would happen, by outcome/i);
    // Las CINCO siguen pintadas, y las cuatro vacias dicen 0.
    expect(within(lista).getAllByRole("listitem")).toHaveLength(5);
    for (const etiqueta of [
      /^Will be invited to join$/, /^Already on your team$/,
      /^Cannot be added$/, /^Invalid row/,
    ]) {
      const fila = within(lista).getByText(etiqueta).closest("li");
      expect(fila.textContent, String(etiqueta)).toMatch(/0/);
    }
    // Positivo, para que lo de arriba no se cumpla con la lista en blanco.
    expect(within(lista).getByText(/^Will be invited$/).closest("li").textContent)
      .toContain("2");
  });

  it("NO ofrece `error` como resultado posible de la previsualizacion", async () => {
    // La sexta categoria solo puede aparecer al CONFIRMAR: una fila valida cuya
    // escritura fallo. `counts` trae las seis, asi que pintar las claves de
    // `counts` la mostraria aqui.
    previewMembersImport.mockResolvedValue(previa({
      total: 1,
      counts: { invite: 1 },
      rows: [{ row: 1, email: "a@x.com", result: "invite" }],
    }));
    render(<ImportMembersClient />);
    await waitFor(() => expect(campoArchivo()).toBeInTheDocument());
    await hastaLaPrevia();
    // Positivo primero (sale en el resumen Y en la fila), para que la asercion
    // negativa no se cumpla con la pantalla en blanco.
    expect(screen.getAllByText(/^Will be invited$/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/could not be created/i)).not.toBeInTheDocument();
  });

  it("no escribe NADA hasta confirmar", async () => {
    previewMembersImport.mockResolvedValue(previa({
      total: 1, counts: { invite: 1 },
      rows: [{ row: 1, email: "a@x.com", result: "invite" }],
    }));
    render(<ImportMembersClient />);
    await waitFor(() => expect(campoArchivo()).toBeInTheDocument());
    await hastaLaPrevia();
    // Positivo: la pantalla SI llego al segundo paso, asi que la asercion
    // negativa de abajo no se cumple por estar en blanco.
    expect(screen.getByRole("button", BOTON_CONFIRMAR)).toBeInTheDocument();
    expect(previewMembersImport).toHaveBeenCalledTimes(1);
    expect(commitMembersImport).not.toHaveBeenCalled();
  });

  it("dice fila por fila que PASARIA, con su numero de fila", async () => {
    previewMembersImport.mockResolvedValue(previa({
      total: 3,
      counts: { invite: 1, already: 1, invalid: 1 },
      rows: [
        { row: 1, email: "uno@x.com", result: "invite" },
        { row: 2, email: "dos@x.com", result: "already" },
        { row: 3, email: "tres@x.com", result: "invalid" },
      ],
    }));
    render(<ImportMembersClient />);
    await waitFor(() => expect(campoArchivo()).toBeInTheDocument());
    await hastaLaPrevia();
    // La SEGUNDA y la TERCERA, no la primera: pulsar o leer la primera no
    // distingue si la pantalla empareja bien correo y resultado.
    const segunda = filaDe("dos@x.com");
    expect(within(segunda).getByText("2")).toBeInTheDocument();
    expect(within(segunda).getByText(/^Already on your team$/)).toBeInTheDocument();
    const tercera = filaDe("tres@x.com");
    expect(within(tercera).getByText("3")).toBeInTheDocument();
    expect(within(tercera).getByText(/^Invalid row/)).toBeInTheDocument();
  });

  it("pinta el NUMERO DE FILA que dio el backend, no su propia cuenta", async () => {
    // Medido: hoy `classify_batch` numera desde 1 y sin huecos
    // (`enumerate(emails, start=1)`), asi que el indice del arreglo y `row`
    // coinciden siempre y las dos cosas se ven igual. Esta prueba fija CUAL de
    // las dos se pinta, para que un cambio del backend -numerar por linea del
    // archivo, por ejemplo- no se pierda en silencio.
    previewMembersImport.mockResolvedValue(previa({
      total: 2, counts: { invite: 2 },
      rows: [
        { row: 7, email: "siete@x.com", result: "invite" },
        { row: 9, email: "nueve@x.com", result: "invite" },
      ],
    }));
    render(<ImportMembersClient />);
    await waitFor(() => expect(campoArchivo()).toBeInTheDocument());
    await hastaLaPrevia();
    expect(within(filaDe("nueve@x.com")).getByText("9")).toBeInTheDocument();
    expect(within(filaDe("siete@x.com")).getByText("7")).toBeInTheDocument();
  });

  it("un 422 del backend por mas de 50 filas se muestra con su mensaje, EN INGLES", async () => {
    // El tope de filas no se puede saber sin leer el archivo: lo informa el
    // backend, con la forma {"errors": [...]} y en espanol. Sin firma, esa
    // prosa espanola se pintaria literal en una interfaz en ingles.
    previewMembersImport.mockRejectedValue({
      status: 422,
      errors: ["El archivo supera el máximo de 50 filas."],
    });
    render(<ImportMembersClient />);
    await waitFor(() => expect(campoArchivo()).toBeInTheDocument());
    elegir(csv());
    pedirPrevia();
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    const texto = screen.getByRole("alert").textContent;
    expect(texto).toMatch(/50 rows/i);
    expect(texto).not.toMatch(/archivo/i);
  });

  it("un 422 por falta de la columna de correo tambien se muestra traducido", async () => {
    previewMembersImport.mockRejectedValue({
      status: 422,
      errors: ["Falta la columna obligatoria 'correo'."],
    });
    render(<ImportMembersClient />);
    await waitFor(() => expect(campoArchivo()).toBeInTheDocument());
    elegir(csv());
    pedirPrevia();
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    const texto = screen.getByRole("alert").textContent;
    expect(texto).toMatch(/correo/);        // el nombre de la columna, que es un dato
    expect(texto).toMatch(/column/i);       // y el resto, en ingles
    expect(texto).not.toMatch(/Falta/);
  });

  it("el 400 de un administrador sin empresa no se confunde con un archivo malo", async () => {
    previewMembersImport.mockRejectedValue({
      status: 400, detail: "Sin compañía asignada.",
    });
    render(<ImportMembersClient />);
    await waitFor(() => expect(campoArchivo()).toBeInTheDocument());
    elegir(csv());
    pedirPrevia();
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByRole("alert").textContent).toMatch(/not linked to a company/i);
  });

  it("elegir OTRO archivo descarta la previsualizacion anterior", async () => {
    // El `commit` vuelve a SUBIR el archivo. Si la previa de A siguiera en
    // pantalla con B en el campo, confirmar importaria B ensenando la previa de A.
    previewMembersImport.mockResolvedValue(previa({
      total: 1, counts: { invite: 1 },
      rows: [{ row: 1, email: "a@x.com", result: "invite" }],
    }));
    render(<ImportMembersClient />);
    await waitFor(() => expect(campoArchivo()).toBeInTheDocument());
    await hastaLaPrevia(csv("correo\na@x.com\n", "primero.csv"));
    elegir(csv("correo\nb@x.com\n", "segundo.csv"));
    expect(screen.queryByRole("button", BOTON_CONFIRMAR)).not.toBeInTheDocument();
    expect(screen.getByRole("button", BOTON_PREVIA)).toBeInTheDocument();
  });
});

describe("confirmar", () => {
  const PREVIA_DE_DOS = previa({
    total: 2,
    counts: { invite: 2 },
    rows: [
      { row: 1, email: "uno@x.com", result: "invite" },
      { row: 2, email: "dos@x.com", result: "invite" },
    ],
  });

  it("dice fila por fila que PASO, y no un solo numero", async () => {
    // La importacion es PARCIAL por diseno: cada fila se persiste sola y una
    // que falle no revierte las demas.
    previewMembersImport.mockResolvedValue(PREVIA_DE_DOS);
    commitMembersImport.mockResolvedValue(resultado({
      total: 3, invitations_issued: 1, email_failed: 0,
      counts: { invite: 1, already: 1, error: 1 },
      rows: [
        { row: 1, email: "uno@x.com", result: "invite", email_sent: true },
        { row: 2, email: "dos@x.com", result: "already" },
        { row: 3, email: "tres@x.com", result: "error" },
      ],
    }));
    render(<ImportMembersClient />);
    await waitFor(() => expect(campoArchivo()).toBeInTheDocument());
    await hastaLaPrevia();
    fireEvent.click(screen.getByRole("button", BOTON_CONFIRMAR));
    await waitFor(() => expect(screen.getByText(/what happened/i)).toBeInTheDocument());

    // La SEGUNDA y la TERCERA: la fila que fallo tiene que distinguirse de la
    // que no, y cada correo ir con su resultado.
    const segunda = filaDe("dos@x.com");
    expect(within(segunda).getByText("2")).toBeInTheDocument();
    expect(within(segunda).getByText(/^Already on your team$/)).toBeInTheDocument();
    const tercera = filaDe("tres@x.com");
    expect(within(tercera).getByText("3")).toBeInTheDocument();
    expect(within(tercera).getByText(/^Could not be created$/)).toBeInTheDocument();

    // `email_sent` SOLO viene en las filas `invite` y `join`, asi que la fila
    // que ya era miembro no puede decir nada del correo: ni "enviado" ni "no
    // enviado". Las que si lo traen lo dicen.
    expect(within(filaDe("uno@x.com")).getByText(/^Email sent$/)).toBeInTheDocument();
    expect(within(segunda).queryByText(/^Email (sent|not sent)$/)).not.toBeInTheDocument();
    expect(within(tercera).queryByText(/^Email (sent|not sent)$/)).not.toBeInTheDocument();
  });

  it("nombra a quien NO le llego el correo, y solo a esa persona", async () => {
    // `email_failed` cuenta invitaciones CREADAS cuyo correo no salio: esa
    // gente si quedo invitada y su enlace sirve, asi que hay que nombrarla
    // sin pintarlo como un fallo que haga pensar que no se invito a nadie.
    previewMembersImport.mockResolvedValue(PREVIA_DE_DOS);
    commitMembersImport.mockResolvedValue(resultado({
      total: 2, invitations_issued: 2, email_failed: 1,
      counts: { invite: 2 },
      rows: [
        { row: 1, email: "sisalio@x.com", result: "invite", email_sent: true },
        { row: 2, email: "nosalio@x.com", result: "invite", email_sent: false },
      ],
    }));
    render(<ImportMembersClient />);
    await waitFor(() => expect(campoArchivo()).toBeInTheDocument());
    await hastaLaPrevia();
    fireEvent.click(screen.getByRole("button", BOTON_CONFIRMAR));
    const aviso = await waitFor(() => {
      const titulo = screen.getByText(/we could not email these people/i);
      return titulo.closest("div");
    });
    // La que fallo esta nombrada DENTRO del aviso; la que salio bien, no.
    expect(within(aviso).getByText("nosalio@x.com")).toBeInTheDocument();
    expect(within(aviso).queryByText("sisalio@x.com")).not.toBeInTheDocument();
    // Y se dice que SI estan invitadas.
    expect(aviso.textContent).toMatch(/invited/i);
  });

  it("NO da a entender que la gente ya quedo dentro de la empresa", async () => {
    // `membership_changed` es SIEMPRE falso: la carga crea cuentas invitadas y
    // manda invitaciones; la pertenencia ocurre cuando cada persona acepta.
    previewMembersImport.mockResolvedValue(PREVIA_DE_DOS);
    commitMembersImport.mockResolvedValue(resultado({
      total: 2, invitations_issued: 2,
      counts: { invite: 2 },
      rows: [
        { row: 1, email: "uno@x.com", result: "invite", email_sent: true },
        { row: 2, email: "dos@x.com", result: "invite", email_sent: true },
      ],
    }));
    render(<ImportMembersClient />);
    await waitFor(() => expect(campoArchivo()).toBeInTheDocument());
    await hastaLaPrevia();
    fireEvent.click(screen.getByRole("button", BOTON_CONFIRMAR));
    // Habla de ESTAS personas, las del archivo. La redaccion anterior era la
    // misma frase que `panel.emptyTitle` ("No one on your team yet"), asi que un
    // hotel con 30 personas que importara 5 leia que no tiene a nadie.
    await waitFor(() => expect(
      screen.getByText(/none of these people are on your team yet/i),
    ).toBeInTheDocument());
    expect(screen.queryByText(/joined your team/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/added to your team/i)).not.toBeInTheDocument();
  });

  it("DOS submits del formulario importan UNA sola vez", async () => {
    // Un `submit` ignora el `disabled` del boton, asi que este mecanismo y el
    // de abajo son distintos y cada uno necesita su prueba.
    previewMembersImport.mockResolvedValue(PREVIA_DE_DOS);
    const { promesa, resolver } = diferida();
    commitMembersImport.mockReturnValue(promesa);
    render(<ImportMembersClient />);
    await waitFor(() => expect(campoArchivo()).toBeInTheDocument());
    await hastaLaPrevia();
    const formulario = screen.getByRole("button", BOTON_CONFIRMAR).closest("form");
    fireEvent.submit(formulario);
    fireEvent.submit(formulario);
    expect(commitMembersImport).toHaveBeenCalledTimes(1);
    resolver(resultado());
    await waitFor(() => expect(commitMembersImport).toHaveBeenCalledTimes(1));
  });

  it("el boton de confirmar queda inerte mientras la peticion esta en vuelo", async () => {
    previewMembersImport.mockResolvedValue(PREVIA_DE_DOS);
    const { promesa, resolver } = diferida();
    commitMembersImport.mockReturnValue(promesa);
    render(<ImportMembersClient />);
    await waitFor(() => expect(campoArchivo()).toBeInTheDocument());
    await hastaLaPrevia();
    fireEvent.click(screen.getByRole("button", BOTON_CONFIRMAR));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /importing/i })).toBeDisabled();
    });
    resolver(resultado());
    await waitFor(() => expect(screen.getByText(/what happened/i)).toBeInTheDocument());
  });

  it("si el confirmar falla lo dice y la previsualizacion sigue ahi", async () => {
    previewMembersImport.mockResolvedValue(PREVIA_DE_DOS);
    commitMembersImport.mockRejectedValue({ status: 503 });
    render(<ImportMembersClient />);
    await waitFor(() => expect(campoArchivo()).toBeInTheDocument());
    await hastaLaPrevia();
    fireEvent.click(screen.getByRole("button", BOTON_CONFIRMAR));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByRole("alert").textContent).toMatch(/waking up/i);
    expect(screen.getByRole("button", BOTON_CONFIRMAR)).toBeInTheDocument();
  });
});

// ── C1: el cuerpo que la pantalla no entendio ───────────────────────────────

describe("C1 — un 200 cuyo cuerpo no tiene la forma esperada", () => {
  // `_cuerpo()` en api.js devuelve `{}` ante CUALQUIER cuerpo que no sea JSON, y
  // eso es exactamente lo que devuelve el proxy de Render mientras el servicio
  // despierta: un 200 con una pagina HTML dentro. `{}` es verdadero, asi que sin
  // puerta la pantalla saltaba al paso 2, decia "0 rows read from your file",
  // pintaba las cinco categorias en 0 y dejaba habilitado "Import these people",
  // que SI sube el archivo de verdad.

  const PREVIA_DE_DOS = previa({
    total: 2,
    counts: { invite: 2 },
    rows: [
      { row: 1, email: "uno@x.com", result: "invite" },
      { row: 2, email: "dos@x.com", result: "invite" },
    ],
  });

  const SIN_FORMA = [
    ["{}", {}],
    ["null", null],
    ["un cuerpo sin rows", { total: 2, counts: conteos({ invite: 2 }) }],
    ["un total que no es numero", { total: "2", counts: conteos(), rows: [] }],
  ];

  for (const [nombre, cuerpo] of SIN_FORMA) {
    it(`la previa con ${nombre} es un fallo reintentable, no el paso 2`, async () => {
      previewMembersImport.mockResolvedValue(cuerpo);
      render(<ImportMembersClient />);
      await waitFor(() => expect(campoArchivo()).toBeInTheDocument());
      elegir(csv());
      pedirPrevia();
      await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
      expect(screen.getByRole("alert").textContent).toMatch(/something went wrong/i);
      // Nada del paso 2: ni el boton que importa de verdad, ni el "0 filas"
      // que afirmaria haber leido el archivo.
      expect(screen.queryByRole("button", BOTON_CONFIRMAR)).not.toBeInTheDocument();
      expect(screen.queryByText(/rows read from your file/i)).not.toBeInTheDocument();
      expect(commitMembersImport).not.toHaveBeenCalled();
      // Y el paso 1 sigue ahi para volver a intentarlo.
      expect(screen.getByRole("button", BOTON_PREVIA)).toBeInTheDocument();
    });
  }

  for (const [nombre, cuerpo] of SIN_FORMA) {
    it(`el resultado con ${nombre} no afirma que no se emitio ninguna invitacion`, async () => {
      // Esta es la puerta que miente DESPUES de haber escrito de verdad: el
      // backend pudo emitir 50 invitaciones y la pantalla decia "0 of 0 rows
      // became an invitation".
      previewMembersImport.mockResolvedValue(PREVIA_DE_DOS);
      commitMembersImport.mockResolvedValue(cuerpo);
      render(<ImportMembersClient />);
      await waitFor(() => expect(campoArchivo()).toBeInTheDocument());
      await hastaLaPrevia();
      fireEvent.click(screen.getByRole("button", BOTON_CONFIRMAR));
      await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
      expect(screen.getByRole("alert").textContent).toMatch(/something went wrong/i);
      expect(screen.queryByText(/became an invitation/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/^what happened$/i)).not.toBeInTheDocument();
    });
  }

  it("y un cuerpo CON la forma si entra al paso 2", async () => {
    // El positivo de la puerta: sin el, las ocho aserciones de arriba se
    // cumplirian con una puerta que rechaza todo.
    previewMembersImport.mockResolvedValue(PREVIA_DE_DOS);
    render(<ImportMembersClient />);
    await waitFor(() => expect(campoArchivo()).toBeInTheDocument());
    await hastaLaPrevia();
    expect(screen.getByText(/2 rows read from your file/i)).toBeInTheDocument();
  });

  it("una previa con cero filas DE VERDAD si entra al paso 2", async () => {
    // Un csv con encabezados y sin nadie es un cuerpo legitimo con rows: [] y
    // total 0: la puerta no puede confundirlo con el cuerpo que no se entendio.
    previewMembersImport.mockResolvedValue(previa({ total: 0, rows: [] }));
    render(<ImportMembersClient />);
    await waitFor(() => expect(campoArchivo()).toBeInTheDocument());
    await hastaLaPrevia();
    expect(screen.getByText(/0 rows read from your file/i)).toBeInTheDocument();
  });
});

describe("empezar de nuevo", () => {
  it("M55: limpia TAMBIEN el archivo del campo", async () => {
    // Dejarlo ahi con el estado ya borrado mostraria un nombre de archivo
    // elegido y un boton que no puede hacer nada. Se mide lo que se ESCRIBE en
    // el campo: jsdom no refleja en `value` el archivo que `fireEvent` asigna,
    // asi que leer `value` no distinguiria nada.
    previewMembersImport.mockResolvedValue(previa({
      total: 1, counts: { invite: 1 },
      rows: [{ row: 1, email: "uno@x.com", result: "invite" }],
    }));
    render(<ImportMembersClient />);
    await waitFor(() => expect(campoArchivo()).toBeInTheDocument());
    await hastaLaPrevia();

    const campo = campoArchivo();
    const escrituras = [];
    const original = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, "value",
    );
    Object.defineProperty(campo, "value", {
      configurable: true,
      get: () => original.get.call(campo),
      set: (v) => { escrituras.push(v); },
    });

    fireEvent.click(screen.getByRole("button", { name: /start over with another file/i }));
    await waitFor(() => expect(screen.getByRole("button", BOTON_PREVIA)).toBeInTheDocument());
    expect(escrituras).toContain("");
    // Y el foco vuelve al campo, que es lo unico que queda por hacer.
    expect(document.activeElement).toBe(campo);
  });
});

describe("la copia de los topes", () => {
  // m5: `errors.fileTooBig`, `errors.fileTooManyRows` e `import.limits` decian
  // los topes A MANO ("1024 KB", "50 rows", "1 MB") en los dos idiomas,
  // mientras las firmas de `companyAdmin.js` los derivan de `IMPORT_LIMITS`.
  // Un tope que se moviera dejaba la copia mintiendo en los dos idiomas.
  const CLAVES = ["errors.fileTooBig", "errors.fileTooManyRows", "import.limits"];

  function cadena(mensajes, ruta) {
    return ruta.split(".").reduce((o, k) => o[k], mensajes.companyAdmin);
  }

  it("ni un tope escrito a mano, en ninguno de los dos idiomas", () => {
    for (const [idioma, mensajes] of [["en", en], ["es", es]]) {
      for (const ruta of CLAVES) {
        const texto = cadena(mensajes, ruta);
        expect(texto, `${idioma} ${ruta}`).toMatch(/\{max(Kb|Rows)\}/);
        // Ningun digito: "1024 KB", "50 rows" y "1 MB" lo llevan.
        expect(texto, `${idioma} ${ruta}`).not.toMatch(/\d/);
      }
    }
  });

  it("y en pantalla los topes salen interpolados con el valor de IMPORT_LIMITS", async () => {
    const kb = String(IMPORT_LIMITS.maxBytes / 1024);
    previewMembersImport.mockRejectedValue({
      status: 422,
      errors: [`El archivo supera el máximo de ${IMPORT_LIMITS.maxRows} filas.`],
    });
    render(<ImportMembersClient />);
    await waitFor(() => expect(campoArchivo()).toBeInTheDocument());
    // El tope de tamano, en la linea que lo anuncia y en el rechazo local.
    expect(screen.getByText(new RegExp(`${kb} KB`))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`${IMPORT_LIMITS.maxRows} people per file`)))
      .toBeInTheDocument();
    elegir(csv("a".repeat(IMPORT_LIMITS.maxBytes + 1)));
    expect(screen.getByText(new RegExp(`limit is ${kb} KB`))).toBeInTheDocument();
    // Y el tope de filas, que solo el backend sabe, en su mensaje traducido.
    elegir(csv());
    pedirPrevia();
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByRole("alert").textContent)
      .toMatch(new RegExp(`more than ${IMPORT_LIMITS.maxRows} rows`));
  });

  it("I3: 'todavia no estan dentro' no es la frase de la empresa vacia", () => {
    // `import.notYetMembers` decia literalmente lo mismo que `panel.emptyTitle`,
    // asi que un hotel con 30 personas que importa 5 leia que no tiene a nadie.
    for (const [idioma, mensajes] of [["en", en], ["es", es]]) {
      const c = mensajes.companyAdmin;
      expect(c.import.notYetMembers.toLowerCase(), idioma)
        .not.toContain(c.panel.emptyTitle.toLowerCase());
      // Y sigue diciendo de QUIEN habla: de las personas de este archivo.
      expect(c.import.notYetMembers, idioma).toMatch(/these|estas/i);
    }
  });
});
