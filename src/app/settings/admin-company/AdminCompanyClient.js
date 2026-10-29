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
 * CUATRO situaciones que en pantalla se parecen y no son la misma. Se
 * distinguen por el ESTADO del error, nunca por si hubo error:
 *   - 403              → no tiene acceso a esta pantalla.
 *   - 400              → su cuenta no está ligada a una empresa.
 *   - cualquier otro    → no pudimos cargar: error con reintentar.
 *   - carga OK y vacía → la pantalla que invita a empezar.
 * El estado de "empieza a invitar" se muestra SOLO cuando la carga fue exitosa
 * y el roster quedó vacío sin búsqueda. Mostrarlo tras un fallo invitaría al
 * jefe a actuar sobre datos que nunca llegaron, y en Render (plan free) el
 * servicio tarda hasta un minuto en despertar, así que el fallo pasa de verdad.
 *
 * Las acciones sobre una persona (invitar, reenviar, cancelar, editar,
 * desactivar, desvincular) son de la Tarea 7. Esta pantalla entrega la tabla
 * que se puede leer y deja el lugar donde se enganchan: el atributo
 * `data-actions-for` de la celda de acciones, presente SOLO en las filas donde
 * `canAct` es verdadero.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getCompanyMembers } from "../../../lib/api";
import { isAuthenticated } from "../../../lib/session";
import { buildRoster, filterRoster, errorMessageFor } from "../../../lib/companyAdmin";
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
  FALLO: "fallo",              // todo lo demás: reintentable
};

/** Fase de pantalla para un error de carga, por su ESTADO y no por su texto.
 *  Un 403 y un backend dormido se parecen en pantalla y piden lo contrario:
 *  uno no tiene arreglo desde aquí, el otro se arregla reintentando. */
function faseDeError(err) {
  const status = err && err.status;
  if (status === 403) return FASE.SIN_ACCESO;
  if (status === 400) return FASE.SIN_EMPRESA;
  return FASE.FALLO;
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
        setDatos(res || {});
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

  /** Vuelve a la pantalla de carga. La llama todo lo que cambia la petición
   *  (buscar, limpiar, paginar, reintentar), porque es una acción de la persona
   *  y no un efecto del render. */
  const empezarCarga = useCallback(() => {
    setFase(FASE.CARGANDO);
    setDespertando(false);
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

  const reintentar = useCallback(() => {
    empezarCarga();
    setIntento((n) => n + 1);
  }, [empezarCarga]);

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

  // La carga falló: el motivo real del backend —el panel es privado, así que
  // `errorMessageFor` va SIN `safe`— y un botón para volver a intentarlo.
  if (fase === FASE.FALLO) {
    return (
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>{t("panel.loadFailedTitle")}</h2>
        <p className={styles.muted}>{t("panel.loadFailedBody")}</p>
        <p className={styles.error} role="alert">{errorMessageFor(errorCarga, t)}</p>
        <button
          type="button"
          className="btn-ghost"
          onClick={reintentar}
        >
          {t("panel.retry")}
        </button>
      </section>
    );
  }

  const total = Number(datos && datos.total) || 0;
  const roster = filterRoster(buildRoster(datos || {}), q);

  // Empresa vacía DE VERDAD: carga exitosa, sin búsqueda y sin nadie. Es el
  // caso de todo cliente nuevo, porque la carga la hace el jefe.
  if (roster.length === 0 && !q) {
    return (
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>{t("panel.emptyTitle")}</h2>
        <p className={styles.muted}>{t("panel.emptyBody")}</p>
        {/* El formulario existe porque el diseño §6.3 lo pide en este estado:
            un campo de correo VISIBLE con su etiqueta. Enviarlo es de la Tarea
            7, que reemplaza `invitar` por su mutación. */}
        <form className={styles.inviteForm} onSubmit={invitarPendienteDeT7}>
          <label className={styles.fieldLabel} htmlFor="invite-email">
            {t("panel.emailLabel")}
          </label>
          <input
            className={styles.input}
            id="invite-email"
            name="email"
            type="email"
            autoComplete="off"
          />
          <div className={styles.inviteActions}>
            <button type="submit" className="btn-primary">{t("panel.invite")}</button>
            <a className={styles.link} href={`${RUTA}/import`}>{t("panel.uploadFile")}</a>
          </div>
        </form>
      </section>
    );
  }

  // El contador cuenta MIEMBROS, que son los que el backend pagina y los que
  // suma en `total`; las invitaciones vuelven completas y no caben en ese rango.
  const enLaPagina = Array.isArray(datos && datos.members) ? datos.members.length : 0;
  const desde = total === 0 ? 0 : offset + 1;
  const hasta = offset + enLaPagina;
  const hayMas = offset + POR_PAGINA < total;
  const hayInvitaciones = roster.some((f) => f.kind === "invitation");

  return (
    <section className={styles.card}>
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
                    </td>
                    {/* El lugar de la Tarea 7. En las filas de los pares
                        administradores (`canAct` falso) la celda va vacía y SIN
                        el enganche: el backend rechaza toda escritura sobre
                        ellos, y mostrar botones deshabilitados obligaría a
                        explicar por qué, que exigiría hablar de roles. */}
                    <td {...(fila.canAct ? { "data-actions-for": fila.key } : {})} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.pager}>
            <p className={styles.count}>
              {t("panel.count", { from: desde, to: hasta, total })}
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
              persona al avanzar. */}
          {total > POR_PAGINA && hayInvitaciones && (
            <p className={styles.muted}>{t("panel.pendingNote")}</p>
          )}
        </>
      )}
    </section>
  );
}

/** Enganche de la Tarea 7: enviar la invitación es su mutación, no la de esta
 *  tarea. Hasta entonces el formulario del estado vacío no manda nada —y no
 *  recarga la página, que es lo que haría un `submit` sin manejador—. */
function invitarPendienteDeT7(e) {
  e.preventDefault();
}
