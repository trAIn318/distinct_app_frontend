"use client";

/**
 * AdminCompanyClient — el panel del jefe de una empresa cliente: su gente.
 *
 * Una sola tabla con todas las personas, miembros e invitaciones unidos, cada
 * una con su estado. La decisión de estado, la unión de las dos colecciones, el
 * filtro del navegador y la traducción de errores NO viven aquí: viven en
 * `src/lib/companyAdmin.js`, que no tiene red ni React y está probada aparte.
 * Aquí solo quedan la carga, los estados de pantalla y la tabla.
 *
 * CINCO situaciones que en pantalla se parecen y no son la misma. Se
 * distinguen por el ESTADO del error, nunca por si hubo error:
 *   - 403              → no tiene acceso a esta pantalla.
 *   - 400              → su cuenta no está ligada a una empresa.
 *   - 401              → su sesión venció: a iniciar sesión, NO a reintentar.
 *   - cualquier otro    → no pudimos cargar: error con reintentar.
 *   - carga OK y vacía → la pantalla que invita a empezar.
 * El estado de "empieza a invitar" se muestra SOLO cuando la carga fue exitosa,
 * tiene la FORMA esperada, el roster quedó vacío sin búsqueda y estamos en la
 * primera página. Mostrarlo tras un fallo invitaría al jefe a actuar sobre
 * datos que nunca llegaron, y en Render (plan free) el servicio tarda hasta un
 * minuto en despertar, así que el fallo pasa de verdad. Mostrarlo en una página
 * fuera de rango lo dejaría sin buscador ni paginador: sin camino de vuelta.
 *
 * LAS SEIS ACCIONES sobre una persona viven aquí (invitar, reenviar, cancelar,
 * editar, desactivar, desvincular), y cada una recarga el listado al terminar.
 * Van en la celda marcada con `data-actions-for`, presente SOLO en las filas
 * donde `canAct` es verdadero: el backend rechaza toda escritura sobre los
 * pares administradores, y mostrar botones deshabilitados obligaría a explicar
 * por qué, que exigiría hablar de roles —justo lo que el panel no debe hacer—.
 *
 * Las dos acciones destructivas confirman DENTRO de la página. `window.confirm`
 * bloquea la pestaña entera y `alert()` está prohibido por claude.md §5.5; y
 * las dos tienen que explicar en qué se diferencian, sin una sola palabra del
 * modelo de datos.
 *
 * Lo que se puede saber sin red se rechaza sin red: los cuatro anchos de
 * columna del PATCH se validan en el navegador, porque los mensajes de
 * validación del backend son prosa española que se pintaría literal en una
 * interfaz en inglés.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  addCompanyMember,
  cancelInvitation,
  deactivateCompanyMember,
  getCompanyMembers,
  resendInvitation,
  unlinkCompanyMember,
  updateCompanyMember,
} from "../../../lib/api";
import { isAuthenticated } from "../../../lib/session";
import {
  ROW_STATUS,
  buildMemberPatch,
  buildRoster,
  errorMessageFor,
  filterRoster,
  hoursUntilExpiry,
  memberEditErrors,
} from "../../../lib/companyAdmin";
// La lista de idiomas de la plataforma, que ya es la fuente de verdad del panel
// de ajustes. Duplicarla aquí sería una segunda fuente que se separa en la
// primera incorporación de un idioma.
import { SUPPORTED_LANGUAGES } from "../../../lib/preferences";
import { useT } from "../../../i18n/client";
import styles from "./page.module.css";

const RUTA = "/settings/admin-company";

/** Tamaño de página. El plan deja la elección abierta; es el mismo
 *  `DEFAULT_PAGE_SIZE` del backend, así que la petición no pide un corte que el
 *  servidor tenga que acotar, y cubre de una sola vez a la empresa más grande
 *  que hay hoy (32 personas) sin paginar. */
const POR_PAGINA = 25;

/** A los 4 s se avisa que el servicio puede estar despertando, el mismo gesto
 *  que ya hace `LoginForm` por el mismo motivo medido. */
const AVISO_MS = 4000;

const FASE = {
  CARGANDO: "cargando",
  LISTO: "listo",
  SIN_ACCESO: "sinAcceso",     // 403: el rol no tiene el permiso
  SIN_EMPRESA: "sinEmpresa",   // 400: la cuenta no está ligada a una empresa
  SESION_VENCIDA: "sesionVencida", // 401: el token existe pero ya no sirve
  FALLO: "fallo",              // todo lo demás: reintentable
};

/** Fase de pantalla para un error de carga, por su ESTADO y no por su texto.
 *  Un 403 y un backend dormido se parecen en pantalla y piden lo contrario:
 *  uno no tiene arreglo desde aquí, el otro se arregla reintentando. */
function faseDeError(err) {
  const status = err && err.status;
  if (status === 403) return FASE.SIN_ACCESO;
  if (status === 400) return FASE.SIN_EMPRESA;
  // `isAuthenticated()` solo comprueba que el token EXISTA, no que sirva, así
  // que un token vencido pasa el guard y el primer GET vuelve 401. Reintentar
  // es la única acción que con un token vencido NO puede funcionar.
  if (status === 401) return FASE.SESION_VENCIDA;
  return FASE.FALLO;
}

/** Si el error de una ESCRITURA es que la sesión venció. Mismo criterio que
 *  `faseDeError` —el estado, nunca el texto— y la misma consecuencia: la salida
 *  no es reintentar, es iniciar sesión. Sin esto, un 401 en una acción de fila
 *  decía "Sign in again." dentro del diálogo sin un solo control para hacerlo. */
function esSesionVencida(err) {
  return faseDeError(err) === FASE.SESION_VENCIDA;
}

/** La respuesta del listado, solo si tiene la forma que esta pantalla sabe
 *  leer. `_cuerpo()` en `api.js` devuelve `{}` ante cualquier cuerpo que no sea
 *  JSON —un 200 del proxy de Render con una página HTML dentro llega así—, y
 *  sin esta puerta un 200 vacío o malformado se presentaba como "tu empresa
 *  está vacía": el mismo anti-objetivo que el fallo de carga, pero por la
 *  puerta del ÉXITO. */
function tieneForma(res) {
  return Boolean(res) && Array.isArray(res.members);
}

export default function AdminCompanyClient() {
  const t = useT("companyAdmin");
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [fase, setFase] = useState(FASE.CARGANDO);
  const [datos, setDatos] = useState(null);      // {members, invitations, total}
  const [errorCarga, setErrorCarga] = useState(null);
  const [despertando, setDespertando] = useState(false);

  // Búsqueda: `texto` es lo que se está escribiendo, `q` lo que ya se pidió al
  // servidor. Separarlos evita una petición por tecla sin necesitar temporizadores.
  const [texto, setTexto] = useState("");
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const [intento, setIntento] = useState(0);

  // -- Las seis acciones ---------------------------------------------------
  //
  // `enCurso` es QUE accion esta en vuelo, no un booleano: con un booleano el
  // aviso de "enviando" del formulario de invitacion salia tambien mientras se
  // reenviaba la invitacion de otra fila.
  const [correo, setCorreo] = useState("");
  const [enCurso, setEnCurso] = useState(null);     // null | "invite" | "row" | "dialog"
  // El guard de verdad es el REF, no el estado: dos `submit` en el mismo tick
  // leen el mismo estado viejo, y un `submit` ignora el atributo `disabled`.
  // Por eso los dos mecanismos existen, y cada uno tiene su propia prueba.
  const ocupadoRef = useRef(false);
  const [avisoInvitar, setAvisoInvitar] = useState(null);   // {key, vars, invitationId}
  const [errorInvitar, setErrorInvitar] = useState(null);
  // El error del reenvío que se ofrece DENTRO del aviso tiene su propio cajón.
  // Mandarlo al de `errorInvitar` marcaba inválido el campo de correo —vacío,
  // porque invitar lo limpia al terminar— con `aria-invalid` y
  // `aria-describedby`, así que un lector de pantalla anunciaba inválida la
  // dirección cuando lo que había fallado era la red.
  const [errorReenvio, setErrorReenvio] = useState(null);
  const [aviso, setAviso] = useState(null);                 // acciones de fila
  const [errorAccion, setErrorAccion] = useState(null);
  const [dialogo, setDialogo] = useState(null);             // {tipo, fila}
  const [edicion, setEdicion] = useState(null);             // valores del formulario
  const [erroresCampo, setErroresCampo] = useState({});
  const primerControlRef = useRef(null);
  const disparadorRef = useRef(null);

  // Página privada: sin sesión, a login con ?next= (mismo patrón que
  // PropertiesClient / AccountClient).
  //
  // El `setReady` tiene que pasar DESPUÉS de montar y no se puede derivar en el
  // render: la sesión vive en una cookie que el servidor no puede leer, así que
  // calcularla al renderizar daría un HTML de servidor que dice "sin sesión" y
  // un cliente que dice lo contrario (error de hidratación). Es el patrón que
  // ya usan todas las pantallas privadas del repo.
  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace(`/login?next=${RUTA}`);
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ver arriba
    setReady(true);
  }, [router]);

  useEffect(() => {
    if (!ready) return;
    let vigente = true;
    // No se llama a `warmBackend()`: la petición de verdad ya sale en este
    // mismo instante, así que una llamada de calentamiento en paralelo no
    // adelantaría nada. Lo que falta cuando el servicio duerme es DECIRLO.
    //
    // La fase CARGANDO NO se fija aquí: la fijan el estado inicial y quien
    // dispara una recarga (`empezarCarga`). Así este efecto no provoca un
    // render en cascada, que es lo que el lint del repo señala.
    const avisa = setTimeout(() => {
      if (vigente) setDespertando(true);
    }, AVISO_MS);
    (async () => {
      try {
        const res = await getCompanyMembers({
          ...(q ? { q } : {}),
          limit: POR_PAGINA,
          offset,
        });
        if (!vigente) return;
        // Sin `detail` ni `status`: `errorMessageFor` da el mensaje genérico,
        // que es exactamente lo que se sabe de un cuerpo que no se entiende.
        if (!tieneForma(res)) throw new Error("");
        setDatos(res);
        setErrorCarga(null);
        setFase(FASE.LISTO);
      } catch (err) {
        if (!vigente) return;
        setDatos(null);
        setErrorCarga(err);
        setFase(faseDeError(err));
      } finally {
        if (vigente) setDespertando(false);
      }
    })();
    return () => {
      vigente = false;
      clearTimeout(avisa);
    };
  }, [ready, q, offset, intento]);

  /** Vuelve a la pantalla de carga Y garantiza una petición nueva. La llama
   *  todo lo que cambia la petición (buscar, limpiar, paginar, reintentar),
   *  porque es una acción de la persona y no un efecto del render.
   *
   *  El `setIntento` NO es opcional: la petición la dispara el efecto, cuyas
   *  dependencias son [ready, q, offset, intento]. Fijar la fase en CARGANDO
   *  sin mover ninguna de ellas dejaba la pantalla colgada para siempre —la
   *  vista de CARGANDO es un solo <p>: sin buscador, sin paginador, sin
   *  botón—, y la única salida era recargar. Pasaba con Buscar sobre la misma
   *  consulta (pulsar Enter dos veces en un type=search lo produce), con
   *  Limpiar sin búsqueda puesta y con paginar al mismo offset. `intento` cubre
   *  la clase completa, no solo el caso de Buscar. */
  const empezarCarga = useCallback(() => {
    setFase(FASE.CARGANDO);
    setDespertando(false);
    setIntento((n) => n + 1);
  }, []);

  const buscar = useCallback((e) => {
    if (e) e.preventDefault();
    empezarCarga();
    // Una búsqueda nueva empieza en la primera página: dejar el offset viejo
    // mostraba una tabla vacía con el contador diciendo que había resultados.
    setOffset(0);
    setQ(texto.trim());
  }, [texto, empezarCarga]);

  const limpiar = useCallback(() => {
    empezarCarga();
    setTexto("");
    setOffset(0);
    setQ("");
  }, [empezarCarga]);

  const irA = useCallback((siguiente) => {
    empezarCarga();
    setOffset(siguiente);
  }, [empezarCarga]);

  const volverAlInicio = useCallback(() => {
    irA(0);
  }, [irA]);

  /** Reintentar es `empezarCarga` tal cual: repite la MISMA petición, y el
   *  `intento` que ya incrementa es lo que la dispara. */
  const reintentar = empezarCarga;

  const irALogin = useCallback(() => {
    router.replace(`/login?next=${RUTA}`);
  }, [router]);

  /** Recarga el listado SIN volver a la pantalla de carga: la tabla se queda a
   *  la vista mientras llega la respuesta, asi el aviso de lo que acaba de
   *  pasar no desaparece debajo de un "cargando" de medio segundo. */
  const recargar = useCallback(() => {
    setIntento((n) => n + 1);
  }, []);

  /** Corre una mutacion: guard de reentrada, bandera de que esta en vuelo, y el
   *  error al cajon que corresponda. Ninguna falla en silencio. */
  const correr = useCallback(async (tipo, trabajo, setError) => {
    if (ocupadoRef.current) return;
    ocupadoRef.current = true;
    setEnCurso(tipo);
    setError(null);
    try {
      await trabajo();
    } catch (err) {
      setError(err);
    } finally {
      ocupadoRef.current = false;
      setEnCurso(null);
    }
  }, []);

  const cambiarCorreo = useCallback((ev) => {
    setCorreo(ev.target.value);
  }, []);

  const invitar = useCallback((e) => {
    if (e) e.preventDefault();
    const email = correo.trim();
    // Lo que se sabe sin red se dice sin red, y debajo del campo.
    if (!email) {
      setErrorInvitar({ key: "panel.emailRequired" });
      return;
    }
    correr("invite", async () => {
      setAvisoInvitar(null);
      // El error del reenvío anterior no sobrevive a una invitación nueva: su
      // aviso, que es lo que ofrecía reenviar, tampoco.
      setErrorReenvio(null);
      const res = await addCompanyMember(email);
      // `email_sent: false` NO es un error: la invitacion existe. Render
      // bloquea SMTP y el envio va por un tercero, asi que pasa de verdad;
      // pintarlo en rojo haria pensar que no se invito a nadie.
      const enviado = !(res && res.email_sent === false);
      const invitacion = (res && res.invitation) || {};
      setAvisoInvitar(enviado
        ? { key: "panel.inviteSent", vars: { email } }
        : {
          key: "panel.inviteNoEmail",
          vars: { email },
          invitationId: invitacion.id,
          email,
        });
      setCorreo("");
      recargar();
    }, setErrorInvitar);
  }, [correo, correr, recargar]);

  /** Reenviar, desde la fila o desde el aviso de "no pudimos mandar el correo". */
  const reenviar = useCallback((tipo, id, email, setError) => {
    correr(tipo, async () => {
      setAviso(null);
      const res = await resendInvitation(id);
      const enviado = !(res && res.email_sent === false);
      setAviso({
        key: enviado ? "panel.resendSent" : "panel.resendNoEmail",
        vars: { email },
      });
      recargar();
    }, setError);
  }, [correr, recargar]);

  const reenviarDeLaFila = useCallback((id, email) => {
    reenviar("row", id, email, setErrorAccion);
  }, [reenviar]);

  /** El reenvío que se ofrece dentro del aviso. Sigue siendo del tipo "invite"
   *  —es el mismo bloque y comparte su `disabled`—, pero su error va a SU
   *  cajón, no al del campo de correo. */
  const reenviarDelAviso = useCallback((id, email) => {
    reenviar("invite", id, email, setErrorReenvio);
  }, [reenviar]);

  const cancelar = useCallback((id) => {
    correr("row", async () => {
      setAviso(null);
      await cancelInvitation(id);
      setAviso({ key: "panel.invitationCancelled" });
      recargar();
    }, setErrorAccion);
  }, [correr, recargar]);

  /** Abre un dialogo. Guarda quien lo abrio para devolverle el foco al cerrar. */
  const abrirDialogo = useCallback((tipo, fila) => {
    disparadorRef.current = typeof document !== "undefined" ? document.activeElement : null;
    setErrorAccion(null);
    setErroresCampo({});
    setEdicion(tipo === "edit"
      ? {
        firstname: fila.firstname || "",
        lastname: fila.lastname || "",
        phone: fila.phone || "",
        langCode: fila.langCode || "",
      }
      : null);
    setDialogo({ tipo, fila });
  }, []);

  const cerrarDialogo = useCallback(() => {
    setDialogo(null);
    const vuelve = disparadorRef.current;
    if (vuelve && typeof vuelve.focus === "function") vuelve.focus();
  }, []);

  const confirmarDestructiva = useCallback(() => {
    if (!dialogo) return;
    const { tipo, fila } = dialogo;
    correr("dialog", async () => {
      setAviso(null);
      if (tipo === "deactivate") await deactivateCompanyMember(fila.id);
      else await unlinkCompanyMember(fila.id);
      setAviso({
        key: tipo === "deactivate" ? "panel.deactivated" : "panel.unlinked",
        vars: { name: fila.displayName },
      });
      setDialogo(null);
      recargar();
    }, setErrorAccion);
  }, [dialogo, correr, recargar]);

  const guardarEdicion = useCallback((e) => {
    if (e) e.preventDefault();
    if (!dialogo || dialogo.tipo !== "edit") return;
    const fila = dialogo.fila;
    // El cuerpo lo arma la logica pura, con los nombres de ESCRITURA del
    // backend: el GET devuelve `firstname` y el PATCH exige `usr_firstname`.
    const cuerpo = buildMemberPatch(edicion);
    const errores = memberEditErrors(cuerpo);
    setErroresCampo(errores);
    // Los cuatro anchos se validan aqui: el backend responde "maximo 50
    // caracteres", prosa espanola que se pintaria literal en una interfaz en
    // ingles, y ademas es un viaje de red para decir lo que ya se sabe.
    if (Object.keys(errores).length > 0) return;
    correr("dialog", async () => {
      setAviso(null);
      await updateCompanyMember(fila.id, cuerpo);
      setAviso({ key: "panel.saved" });
      setDialogo(null);
      recargar();
    }, setErrorAccion);
  }, [dialogo, edicion, correr, recargar]);

  const cambiarEdicion = useCallback((campo, valor) => {
    setEdicion((actual) => ({ ...(actual || {}), [campo]: valor }));
  }, []);

  // Escape cierra el dialogo. No mientras hay una escritura en vuelo: cerrarlo
  // ahi dejaria a la persona sin saber en que quedo lo que ya se mando.
  useEffect(() => {
    if (!dialogo) return undefined;
    const alTeclear = (ev) => {
      if (ev.key === "Escape" && !ocupadoRef.current) cerrarDialogo();
    };
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, [dialogo, cerrarDialogo]);

  // Foco al primer control del dialogo al abrirlo (claude.md: navegable por
  // teclado). En los destructivos ese primer control es el de NO hacerlo.
  useEffect(() => {
    if (dialogo && primerControlRef.current) primerControlRef.current.focus();
  }, [dialogo]);

  /** Texto de un aviso o de un error: clave i18n propia, o el error traducido
   *  por `errorMessageFor`, que nunca devuelve cadena vacia. */
  const textoDe = useCallback((x) => {
    if (!x) return "";
    return x.key ? t(x.key, x.vars) : errorMessageFor(x, t);
  }, [t]);

  if (!ready) return null;

  if (fase === FASE.CARGANDO) {
    return (
      <p className={styles.muted} role="status">
        {despertando ? t("panel.waking") : t("panel.loading")}
      </p>
    );
  }

  // 403: no hay nada que reintentar y no hay nada que invitar a hacer.
  if (fase === FASE.SIN_ACCESO) {
    return (
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>{t("panel.noAccessTitle")}</h2>
        <p className={styles.muted}>{t("panel.noAccessBody")}</p>
      </section>
    );
  }

  // 400: la cuenta del administrador no está ligada a ninguna empresa. Sin este
  // estado vería la pantalla de "empieza a invitar" y fallaría en cada intento.
  if (fase === FASE.SIN_EMPRESA) {
    return (
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>{t("panel.noCompanyTitle")}</h2>
        <p className={styles.muted}>{t("panel.noCompanyBody")}</p>
      </section>
    );
  }

  // 401: la sesión venció. Un botón de reintentar aquí es la única acción que
  // NO puede funcionar, y el texto crudo del backend ("Given token not valid
  // for any token type") es prosa del framework en una interfaz que puede estar
  // en español. La salida es iniciar sesión de nuevo, con ?next= para volver.
  if (fase === FASE.SESION_VENCIDA) {
    return (
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>{t("panel.signedOutTitle")}</h2>
        <p className={styles.muted}>{t("panel.signedOutBody")}</p>
        <button type="button" className="btn-primary" onClick={irALogin}>
          {t("panel.signIn")}
        </button>
      </section>
    );
  }

  // La carga falló: el motivo real del backend —el panel es privado, así que
  // `errorMessageFor` va SIN `safe`— y un botón para volver a intentarlo.
  if (fase === FASE.FALLO) {
    return (
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>{t("panel.loadFailedTitle")}</h2>
        {/* Lo que la última acción SÍ hizo, antes de hablar del fallo de carga.
            Cada acción recarga el listado al terminar, así que la recarga puede
            fallar sobre una escritura que sí ocurrió —Render tarda hasta un
            minuto en despertar— y entonces "no ha cambiado nada" sería falso
            justo después de sacar a alguien del equipo. */}
        {aviso && <p className={styles.notice} role="status">{textoDe(aviso)}</p>}
        {/* Y lo que hizo la INVITACIÓN, que es el camino más frecuente y el que
            quedaba fuera: `invitar` también termina en `recargar()`. Con
            `email_sent: false` este aviso es el ÚNICO sitio donde se le dice al
            jefe que el correo no salió y que tiene que avisar por otra vía, así
            que perderlo consume la invitación de 72 h en silencio. */}
        <AvisoInvitacion
          t={t}
          aviso={avisoInvitar}
          texto={textoDe(avisoInvitar)}
          errorReenvio={textoDe(errorReenvio)}
          ocupado={Boolean(enCurso)}
          onReenviar={reenviarDelAviso}
        />
        <p className={styles.muted}>{t("panel.loadFailedBody")}</p>
        <p className={styles.error} role="alert">{errorMessageFor(errorCarga, t)}</p>
        <div className={styles.cardActions}>
          <button
            type="button"
            className="btn-ghost"
            onClick={reintentar}
          >
            {t("panel.retry")}
          </button>
          {/* Reintentar conserva `q`, así que repite LA BÚSQUEDA. Si la
              búsqueda es justo lo que falló, sin esto no queda ningún control
              para volver al listado completo: el buscador no está pintado en
              esta vista. */}
          {q && (
            <button type="button" className={styles.link} onClick={limpiar}>
              {t("panel.showAllAgain")}
            </button>
          )}
        </div>
      </section>
    );
  }

  const total = Number(datos && datos.total) || 0;
  const invitacionesDelBackend = Array.isArray(datos && datos.invitations)
    ? datos.invitations
    : [];

  // Las invitaciones vuelven COMPLETAS en cada respuesta: el backend no las
  // pagina (`company_admin_views.py:166-173` — `total` cuenta solo miembros y
  // el arreglo de invitaciones vuelve entero, sin offset ni limit). Unirlas en
  // cada página hacía aparecer a la misma persona una vez POR PÁGINA, y con las
  // acciones de la Tarea 7 encima habría dos elementos con el mismo
  // `data-actions-for`. Así que entran solo en la primera página, y la nota de
  // abajo lo dice. El recorte se hace AQUÍ y no en `buildRoster`, que no sabe
  // —ni tiene por qué— en qué página está la pantalla.
  const fuente = offset === 0
    ? (datos || {})
    : { ...(datos || {}), invitations: [] };

  // La búsqueda es MIXTA: el `?q=` del backend filtra solo a los miembros y
  // `filterRoster` cubre la otra mitad, las invitaciones, que vuelven sin
  // filtrar y sin nombre.
  //
  // ASIMETRÍA CONOCIDA Y NO ARREGLADA AQUÍ (se documenta a propósito):
  // `filterRoster` normaliza acentos, pero el `?q=` del backend usa
  // `icontains`, que en Postgres NO es insensible a acentos. Buscar "Munoz"
  // ENCUENTRA a una persona invitada cuyo correo contiene "munoz" —vuelve sin
  // filtrar y el filtro del navegador normaliza— y NO encuentra al miembro
  // "Muñoz": el servidor ya no lo devolvió, y este filtro solo puede quitar
  // filas, nunca traerlas. Simetrizarlo es un cambio de BACKEND con
  // implicación de índice (la extensión `unaccent`), así que está fuera del
  // alcance de esta pantalla.
  const roster = filterRoster(buildRoster(fuente), q);

  // Empresa vacía DE VERDAD: carga exitosa, sin búsqueda, en la PRIMERA página
  // y sin nadie. Es el caso de todo cliente nuevo, porque la carga la hace el
  // jefe. El `offset === 0` no es un detalle: sin él, una página que vuelve
  // vacía —alguien desvinculó a cinco personas entre dos peticiones— afirmaba
  // que la empresa está vacía y quitaba el buscador y el paginador.
  if (roster.length === 0 && !q && offset === 0) {
    return (
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>{t("panel.emptyTitle")}</h2>
        {/* A este estado se llega también sacando a la última persona del
            equipo, y entonces "nadie todavía" es el resultado de lo que el jefe
            acaba de hacer: sin el aviso parece que la pantalla se olvidó. */}
        {aviso && <p className={styles.notice} role="status">{textoDe(aviso)}</p>}
        <p className={styles.muted}>{t("panel.emptyBody")}</p>
        {/* El formulario existe porque el diseño §6.3 lo pide en este estado:
            un campo de correo VISIBLE con su etiqueta. Es el MISMO bloque que
            la vista de la tabla, para que invitar se haga igual en las dos. */}
        <BloqueInvitar
          t={t}
          correo={correo}
          onCorreo={cambiarCorreo}
          onSubmit={invitar}
          ocupado={Boolean(enCurso)}
          enviando={enCurso === "invite"}
          error={textoDe(errorInvitar)}
          aviso={avisoInvitar}
          avisoTexto={textoDe(avisoInvitar)}
          errorReenvio={textoDe(errorReenvio)}
          onReenviar={reenviarDelAviso}
        >
          {/* La carga por archivo es la Tarea 8; este enlace es el que el
              diseño §6.3 pide en este estado. */}
          <a className={styles.link} href={`${RUTA}/import`}>{t("panel.uploadFile")}</a>
        </BloqueInvitar>
      </section>
    );
  }

  // Página fuera de rango: la lista se encogió entre dos peticiones. NO es la
  // empresa vacía y no se le parece: hay gente, solo que no en esta página. Su
  // único control es volver a la primera, porque el paginador de abajo no se
  // pinta cuando no hay tabla.
  if (roster.length === 0 && !q) {
    return (
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>{t("panel.outOfRangeTitle")}</h2>
        {/* Tras sacar a la última persona de una página se cae justo aquí, y
            "la lista cambió mientras la mirabas" le atribuye al azar lo que
            acaba de hacer él. */}
        {aviso && <p className={styles.notice} role="status">{textoDe(aviso)}</p>}
        <p className={styles.muted}>{t("panel.outOfRangeBody")}</p>
        <button type="button" className="btn-ghost" onClick={volverAlInicio}>
          {t("panel.backToFirstPage")}
        </button>
      </section>
    );
  }

  // El contador cuenta MIEMBROS, que son los que el backend pagina y los que
  // suma en `total`; las invitaciones vuelven completas y no caben en ese
  // rango. Por eso `panel.count` DICE su unidad ("of N team members"): antes la
  // tabla pintaba miembros más invitaciones y el contador solo miembros, así
  // que una empresa con 0 miembros y 2 invitaciones recién enviadas mostraba
  // dos filas y decía "Showing 0–0 of 0".
  const enLaPagina = datos.members.length;
  const desde = offset + 1;
  const hasta = offset + enLaPagina;
  const hayMas = offset + POR_PAGINA < total;

  const dialogoAbierto = Boolean(dialogo);

  return (
    <section className={styles.card}>
      {/* Invitar desde la tabla, no solo desde el estado vacío: una empresa con
          gente sigue incorporando gente, y volver al estado vacío para hacerlo
          es imposible. */}
      <BloqueInvitar
        t={t}
        titulo={t("panel.addTitle")}
        correo={correo}
        onCorreo={cambiarCorreo}
        onSubmit={invitar}
        ocupado={Boolean(enCurso)}
        enviando={enCurso === "invite"}
        error={textoDe(errorInvitar)}
        aviso={avisoInvitar}
        avisoTexto={textoDe(avisoInvitar)}
        errorReenvio={textoDe(errorReenvio)}
        onReenviar={reenviarDelAviso}
      >
        {/* La carga por archivo va TAMBIÉN aquí, y no solo en el estado vacío:
            ese estado exige `roster.length === 0 && !q && offset === 0`, así que
            la primera invitación lo hacía desaparecer y no volvía nunca. Con el
            enlace solo allí, y el menú enrutando únicamente
            `settings/admin-company`, la pantalla de carga era inalcanzable en
            cuanto la empresa tenía a alguien —y `panel.emptyBody` prometía
            "or upload a file with several at once"—.
            Va como enlace de texto, no como botón dorado: el dorado de esta
            vista es el de invitar (claude.md §2.1, máximo uno por vista). */}
        <a className={styles.link} href={`${RUTA}/import`}>{t("panel.uploadFile")}</a>
      </BloqueInvitar>

      {/* Lo que pasó con la última acción de una fila. Mientras hay un diálogo
          abierto el error se pinta DENTRO del diálogo, que es donde está
          mirando la persona, no detrás de él. */}
      {aviso && !dialogoAbierto && (
        <p className={styles.notice} role="status">{textoDe(aviso)}</p>
      )}
      {!dialogoAbierto && (
        <ErrorDeAccion
          t={t}
          error={errorAccion}
          texto={textoDe(errorAccion)}
          onIrALogin={irALogin}
        />
      )}

      <form className={styles.searchForm} onSubmit={buscar} role="search">
        <label className={styles.fieldLabel} htmlFor="roster-search">
          {t("panel.searchLabel")}
        </label>
        <input
          className={styles.input}
          id="roster-search"
          name="q"
          type="search"
          value={texto}
          onChange={(ev) => setTexto(ev.target.value)}
        />
        <div className={styles.searchActions}>
          <button type="submit" className="btn-ghost">{t("panel.search")}</button>
          {q && (
            <button type="button" className={styles.link} onClick={limpiar}>
              {t("panel.clearSearch")}
            </button>
          )}
        </div>
      </form>

      {roster.length === 0 ? (
        <p className={styles.muted} role="status">{t("panel.noMatches")}</p>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption className="sr-only">{t("panel.tableCaption")}</caption>
              <thead>
                <tr>
                  <th scope="col">{t("panel.colPerson")}</th>
                  <th scope="col">{t("panel.colStatus")}</th>
                  <th scope="col">{t("panel.colActions")}</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((fila) => (
                  <tr key={fila.key}>
                    <th scope="row" className={styles.personCell}>
                      <span className={styles.personName}>{fila.displayName}</span>
                      {/* El correo solo se repite cuando NO es ya el nombre
                          mostrado: una invitación, o una persona heredada sin
                          nombre, se identifica por su correo y pintarlo dos
                          veces en la misma fila no informa de nada. */}
                      {fila.email && fila.email !== fila.displayName && (
                        <span className={styles.personEmail}>{fila.email}</span>
                      )}
                    </th>
                    <td>
                      {/* Color MÁS texto, siempre: quien no distingue colores
                          tiene que poder leer el estado. */}
                      {/* El `|| ""` evita escribir la clase "undefined" si
                          algún día apareciera un estado sin estilo propio: el
                          texto, que es lo que se lee, sigue saliendo igual. */}
                      <span
                        className={`${styles.estado} ${styles[`estado_${fila.status}`] || ""}`}
                      >
                        {t(`status.${fila.status}`)}
                      </span>
                      {/* La vigencia es de 72 h y el estado es BINARIO, así que
                          sin esto el jefe no puede saber si a una invitación le
                          quedan 2 horas o 70, que es justo lo que decide si
                          conviene reenviarla. En texto, no solo en color. */}
                      {horasRestantes(fila) !== null && (
                        <span className={styles.expiry}>
                          {t("panel.expiresIn", { hours: horasRestantes(fila) })}
                        </span>
                      )}
                    </td>
                    {/* En las filas de los pares administradores (`canAct`
                        falso) la celda va vacía y SIN el enganche: el backend
                        rechaza toda escritura sobre ellos, y mostrar botones
                        deshabilitados obligaría a explicar por qué, que
                        exigiría hablar de roles.
                        Cada botón lleva un `aria-label` con la persona: con
                        solo "Reenviar" repetido en veinte filas, ni un lector
                        de pantalla ni una prueba pueden distinguir a cuál
                        pertenece. */}
                    <td {...(fila.canAct ? { "data-actions-for": fila.key } : {})}>
                      {fila.canAct && (
                        <div className={styles.rowActions}>
                          {fila.kind === "invitation" ? (
                            <>
                              <button
                                type="button"
                                className={styles.rowAction}
                                disabled={Boolean(enCurso)}
                                aria-label={t("panel.resendFor", { email: fila.email })}
                                onClick={() => reenviarDeLaFila(fila.id, fila.email)}
                              >
                                {t("panel.resend")}
                              </button>
                              <button
                                type="button"
                                className={styles.rowAction}
                                disabled={Boolean(enCurso)}
                                aria-label={t("panel.cancelInvitationFor", { email: fila.email })}
                                onClick={() => cancelar(fila.id)}
                              >
                                {t("panel.cancelInvitation")}
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className={styles.rowAction}
                                disabled={Boolean(enCurso)}
                                aria-label={t("panel.editFor", { name: fila.displayName })}
                                onClick={() => abrirDialogo("edit", fila)}
                              >
                                {t("panel.edit")}
                              </button>
                              {/* A quien ya está desactivado no se le ofrece
                                  desactivar otra vez: el endpoint es idempotente
                                  y el botón no haría nada observable. */}
                              {fila.status !== ROW_STATUS.DEACTIVATED && (
                                <button
                                  type="button"
                                  className={styles.rowAction}
                                  disabled={Boolean(enCurso)}
                                  aria-label={t("panel.deactivateFor", { name: fila.displayName })}
                                  onClick={() => abrirDialogo("deactivate", fila)}
                                >
                                  {t("panel.deactivate")}
                                </button>
                              )}
                              <button
                                type="button"
                                className={styles.rowAction}
                                disabled={Boolean(enCurso)}
                                aria-label={t("panel.unlinkFor", { name: fila.displayName })}
                                onClick={() => abrirDialogo("unlink", fila)}
                              >
                                {t("panel.unlink")}
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.pager}>
            <p className={styles.count}>
              {/* Hay filas, pero ninguna es miembro: son invitaciones
                  pendientes. Decir "0–0 of 0" delante de dos filas es falso;
                  esta clave dice la verdad Y explica las filas. */}
              {total === 0
                ? t("panel.countNoMembers")
                : t("panel.count", { from: desde, to: hasta, total })}
            </p>
            <div className={styles.pagerButtons}>
              <button
                type="button"
                className="btn-ghost"
                disabled={offset === 0}
                onClick={() => irA(Math.max(0, offset - POR_PAGINA))}
              >
                {t("panel.previous")}
              </button>
              <button
                type="button"
                className="btn-ghost"
                disabled={!hayMas}
                onClick={() => irA(offset + POR_PAGINA)}
              >
                {t("panel.next")}
              </button>
            </div>
          </div>

          {/* Las invitaciones pendientes vuelven COMPLETAS del backend: no se
              paginan, así que se listan en la primera página y se dice, en vez
              de repetirlas en todas y hacer aparecer dos veces a la misma
              persona al avanzar.
              La condición mira lo que DEVOLVIÓ el backend, no lo que quedó en
              el roster: en la página 2 el roster ya no las tiene, y es justo
              ahí donde el jefe necesita saber dónde están. */}
          {invitacionesDelBackend.length > 0 && (hayMas || offset > 0) && (
            <p className={styles.muted}>{t("panel.pendingNote")}</p>
          )}
        </>
      )}

      {/* Confirmación DENTRO de la página: `window.confirm` bloquea la pestaña
          entera y `alert()` está prohibido (claude.md §5.5). Con foco manejable
          y Escape para salir. */}
      {dialogo && dialogo.tipo === "edit" && (
        <Dialogo titulo={t("panel.editFor", { name: dialogo.fila.displayName })}>
          <form className={styles.dialogForm} onSubmit={guardarEdicion}>
            <CampoEdicion
              t={t}
              id="edit-firstname"
              etiqueta={t("panel.firstName")}
              valor={edicion.firstname}
              onCambio={(v) => cambiarEdicion("firstname", v)}
              error={erroresCampo.usr_firstname}
              campo="usr_firstname"
              inputRef={primerControlRef}
              autoComplete="given-name"
            />
            <CampoEdicion
              t={t}
              id="edit-lastname"
              etiqueta={t("panel.lastName")}
              valor={edicion.lastname}
              onCambio={(v) => cambiarEdicion("lastname", v)}
              error={erroresCampo.usr_lastname}
              campo="usr_lastname"
              autoComplete="family-name"
            />
            <CampoEdicion
              t={t}
              id="edit-phone"
              etiqueta={t("panel.phone")}
              valor={edicion.phone}
              onCambio={(v) => cambiarEdicion("phone", v)}
              error={erroresCampo.usr_phone}
              campo="usr_phone"
              tipo="tel"
              autoComplete="tel"
            />

            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="edit-language">
                {t("panel.language")}
                {/* El único de los cuatro que el backend NO acepta vacío, así
                    que es el único obligatorio: `required` MÁS indicador
                    visible, como pide claude.md §5.5. */}
                <span className={styles.requerido} aria-hidden="true"> *</span>
                <span className="sr-only"> ({t("accept.required")})</span>
              </label>
              <select
                className={styles.input}
                id="edit-language"
                name="lang_code"
                required
                value={edicion.langCode}
                onChange={(ev) => cambiarEdicion("langCode", ev.target.value)}
                aria-invalid={erroresCampo.lang_code ? "true" : undefined}
                aria-describedby={erroresCampo.lang_code ? "lang_code-error" : undefined}
              >
                {/* Los 50 usuarios heredados pueden no tener idioma. Sin esta
                    opción el `select` mostraría el primero de la lista como si
                    ya fuera su elección, y guardarlo cambiaría un dato que
                    nadie pidió cambiar. */}
                {!SUPPORTED_LANGUAGES.some((l) => l.code === edicion.langCode) && (
                  <option value="">{t("panel.languageUnset")}</option>
                )}
                {SUPPORTED_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>{l.label}</option>
                ))}
              </select>
              {erroresCampo.lang_code && (
                <p className={styles.fieldError} id="lang_code-error">
                  {textoDe(erroresCampo.lang_code)}
                </p>
              )}
            </div>

            <ErrorDeAccion
              t={t}
              error={errorAccion}
              texto={textoDe(errorAccion)}
              onIrALogin={irALogin}
            />

            <div className={styles.dialogActions}>
              <button
                type="button"
                className="btn-ghost"
                onClick={cerrarDialogo}
                disabled={enCurso === "dialog"}
              >
                {t("panel.keepAsIs")}
              </button>
              <button type="submit" className="btn-ghost" disabled={enCurso === "dialog"}>
                {enCurso === "dialog" ? t("panel.working") : t("panel.save")}
              </button>
            </div>
          </form>
        </Dialogo>
      )}

      {/* Los dos destructivos. Tienen que explicar en qué se DIFERENCIAN, y
          hacerlo sin una palabra del modelo de datos: desactivar se revierte,
          desvincular saca a la persona del equipo. */}
      {dialogo && dialogo.tipo !== "edit" && (
        <Dialogo
          titulo={t(
            dialogo.tipo === "deactivate" ? "panel.deactivateTitle" : "panel.unlinkTitle",
            { name: dialogo.fila.displayName },
          )}
        >
          <p className={styles.dialogBody}>
            {t(
              dialogo.tipo === "deactivate" ? "panel.deactivateBody" : "panel.unlinkBody",
              { name: dialogo.fila.displayName },
            )}
          </p>
          <ErrorDeAccion
            t={t}
            error={errorAccion}
            texto={textoDe(errorAccion)}
            onIrALogin={irALogin}
          />
          <div className={styles.dialogActions}>
            {/* El primer control, y el que recibe el foco al abrir, es el de NO
                hacerlo: en una acción destructiva el camino por omisión del
                teclado no puede ser la destrucción. */}
            <button
              ref={primerControlRef}
              type="button"
              className="btn-ghost"
              onClick={cerrarDialogo}
              disabled={enCurso === "dialog"}
            >
              {t("panel.keepAsIs")}
            </button>
            <button
              type="button"
              className={styles.dangerButton}
              onClick={confirmarDestructiva}
              disabled={enCurso === "dialog"}
            >
              {enCurso === "dialog"
                ? t("panel.working")
                : t(dialogo.tipo === "deactivate" ? "panel.deactivate" : "panel.unlink")}
            </button>
          </div>
        </Dialogo>
      )}
    </section>
  );
}

/** Horas que le quedan a una invitación pendiente, o `null` si no hay nada que
 *  decir: una invitación ya vencida lo dice en su estado, y una fecha que no se
 *  pudo leer no autoriza a afirmar "vence en 0 h". */
function horasRestantes(fila) {
  if (!fila || fila.kind !== "invitation") return null;
  const horas = hoursUntilExpiry(fila.expiresAt);
  return horas && horas > 0 ? horas : null;
}

/** El cascarón de un diálogo en la página: fondo, panel, y el nombre accesible.
 *  Escape y el foco los maneja el componente de la pantalla, que es quien sabe
 *  si hay una escritura en vuelo. */
function Dialogo({ titulo, children }) {
  return (
    <div className={styles.dialogBackdrop}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-label={titulo}>
        <h2 className={styles.dialogTitle}>{titulo}</h2>
        {children}
      </div>
    </div>
  );
}

/** El error de una escritura, con la salida que ese error admite.
 *
 *  Un 401 no se arregla reintentando: la única acción posible es iniciar sesión
 *  de nuevo, y hasta ahora el mensaje "Sign in again." aparecía DENTRO del
 *  diálogo sin un solo control para hacerlo —el camino de carga sí lo tiene—.
 *
 *  El botón va en `btn-ghost` y no en `btn-primary`: la vista de la tabla ya
 *  gasta su único dorado en invitar (claude.md §2.1), y con un diálogo abierto
 *  encima se contarían dos.
 */
function ErrorDeAccion({ t, error, texto, onIrALogin }) {
  if (!error) return null;
  return (
    <>
      <p className={styles.error} role="alert">{texto}</p>
      {esSesionVencida(error) && (
        <button type="button" className="btn-ghost" onClick={onIrALogin}>
          {t("panel.signIn")}
        </button>
      )}
    </>
  );
}

/** Un campo de texto del formulario de edición, con su etiqueta asociada de
 *  verdad y su error DEBAJO del campo (claude.md §5.5), nunca en un `alert()`. */
function CampoEdicion({
  t, id, etiqueta, valor, onCambio, error, campo, inputRef, tipo = "text", autoComplete,
}) {
  const idError = `${campo}-error`;
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel} htmlFor={id}>{etiqueta}</label>
      <input
        ref={inputRef}
        className={styles.input}
        id={id}
        name={campo}
        type={tipo}
        value={valor}
        autoComplete={autoComplete}
        onChange={(ev) => onCambio(ev.target.value)}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? idError : undefined}
      />
      {error && (
        <p className={styles.fieldError} id={idError}>{t(error.key, error.vars)}</p>
      )}
    </div>
  );
}

/** Invitar por correo. Vive en las DOS vistas que lo ofrecen -el estado vacío y
 *  la tabla-, para que sea el mismo formulario y no dos que se separan.
 *
 *  `aviso` puede traer el caso de "la invitación existe pero el correo no
 *  salió", que NO es un error: trae la invitación para poder reenviarla.
 */
function BloqueInvitar({
  t, titulo, correo, onCorreo, onSubmit, ocupado, enviando, error, aviso, avisoTexto,
  errorReenvio, onReenviar, children,
}) {
  return (
    <div className={styles.inviteBlock}>
      {titulo && <h2 className={styles.blockTitle}>{titulo}</h2>}
      <form className={styles.inviteForm} onSubmit={onSubmit}>
        <label className={styles.fieldLabel} htmlFor="invite-email">
          {t("panel.emailLabel")}
          {/* claude.md §5.5: campo obligatorio = atributo `required` MÁS un
              indicador visible. El asterisco es el indicador; el texto entre
              paréntesis es su equivalente para quien usa lector de pantalla,
              porque un asterisco solo no se lee como "obligatorio". */}
          <span className={styles.requerido} aria-hidden="true"> *</span>
          <span className="sr-only"> ({t("accept.required")})</span>
        </label>
        <input
          className={styles.input}
          id="invite-email"
          name="email"
          type="email"
          required
          autoComplete="off"
          value={correo}
          onChange={onCorreo}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? "invite-email-error" : undefined}
        />
        {error && (
          <p className={styles.fieldError} id="invite-email-error" role="alert">{error}</p>
        )}
        <div className={styles.inviteActions}>
          {/* `disabled` mientras hay algo en vuelo, Y el guard de reentrada en
              el manejador: un `submit` ignora `disabled`, así que uno solo de
              los dos no evita la invitación doble. */}
          <button type="submit" className="btn-primary" disabled={ocupado}>
            {t("panel.invite")}
          </button>
          {children}
        </div>
      </form>
      {enviando && <p className={styles.muted} role="status">{t("panel.sending")}</p>}
      <AvisoInvitacion
        t={t}
        aviso={aviso}
        texto={avisoTexto}
        errorReenvio={errorReenvio}
        ocupado={ocupado}
        onReenviar={onReenviar}
      />
    </div>
  );
}

/** Lo que la invitación SÍ hizo, con su botón de reenviar y con el sitio propio
 *  del error de ese reenvío.
 *
 *  Vive aparte porque lo pintan DOS vistas: el bloque de invitar y la vista de
 *  FALLO DE CARGA. Cada acción recarga el listado al terminar, así que la
 *  recarga puede fallar sobre una invitación que sí se creó —Render tarda hasta
 *  un minuto en despertar— y ahí este aviso es lo único que distingue "no ha
 *  cambiado nada" de "la invitación existe pero el correo no salió".
 *
 *  El error del reenvío va en su propio párrafo y NO al cajón del campo de
 *  correo: lo que falla aquí es la red, no la dirección que escribió el jefe. */
function AvisoInvitacion({ t, aviso, texto, errorReenvio, ocupado, onReenviar }) {
  if (!aviso && !errorReenvio) return null;
  return (
    <>
      {aviso && (
        <p className={styles.notice} role="status">
          {texto}
          {aviso.invitationId ? (
            <button
              type="button"
              className={styles.link}
              disabled={ocupado}
              onClick={() => onReenviar(aviso.invitationId, aviso.email)}
            >
              {t("panel.resend")}
            </button>
          ) : null}
        </p>
      )}
      {errorReenvio && (
        <p className={styles.error} role="alert">{errorReenvio}</p>
      )}
    </>
  );
}
