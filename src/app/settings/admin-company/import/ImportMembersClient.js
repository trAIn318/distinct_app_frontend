"use client";

/**
 * ImportMembersClient — la carga de personal por archivo, en DOS pasos.
 *
 * elegir archivo → ver qué pasaría → confirmar. **Nada se escribe hasta
 * confirmar**: el primer paso llama a `/import/preview/`, que no persiste ni
 * envía nada, y solo el segundo llama a `/import/`.
 *
 * SOLO CSV. `parse_members_csv` es el único camino del backend y no tiene rama
 * de ZIP: un .zip aquí es un archivo que el servidor no puede leer. En este
 * mismo proyecto existe OTRA carga —la de analítica/propiedades— que sí acepta
 * ZIP y CSV; es otro contrato y no se imita aquí.
 *
 * LOS ENCABEZADOS DEL ARCHIVO ESTÁN EN ESPAÑOL (`correo,nombre,apellido`) y la
 * pantalla los muestra literales, incluso en la interfaz en inglés: los decide
 * el backend. La plantilla NO se escribe aquí: se descarga la que genera el
 * backend (`getImportTemplate`), así no hay una segunda versión del encabezado
 * que se pueda separar de la primera.
 *
 * LA IMPORTACIÓN ES PARCIAL POR DISEÑO: cada fila se persiste sola y una que
 * falle no revierte las demás. Por eso el resultado dice **fila por fila** qué
 * pasó y no un solo número, y por eso nombra a quien no le pudo llegar el
 * correo: esa gente SÍ quedó invitada y su enlace sirve (Render bloquea SMTP y
 * el envío va por un tercero, así que es un escenario real), de modo que se
 * nombra sin pintarlo como un fallo que haga pensar que no se invitó a nadie.
 *
 * Y LA CARGA NO METE A NADIE EN LA EMPRESA: `membership_changed` es siempre
 * falso. Crea cuentas invitadas y manda invitaciones; la pertenencia ocurre
 * cuando cada persona acepta. La pantalla lo dice en el resultado.
 *
 * Lo que se puede saber SIN RED —extensión, tamaño, archivo vacío— se rechaza
 * aquí con `fileRejectionKey`, sin llamar al backend. El tope de 50 filas no se
 * puede saber sin leer el archivo: ese lo informa el backend y su mensaje se
 * muestra traducido (las firmas viven en `companyAdmin.js`; el texto crudo del
 * backend es prosa española).
 */

import { useCallback, useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

import {
  commitMembersImport,
  getImportTemplate,
  previewMembersImport,
} from "../../../../lib/api";
import { isAuthenticated } from "../../../../lib/session";
import {
  IMPORT_LIMITS,
  errorMessageFor,
  fileRejectionKey,
  previewCategoryKey,
} from "../../../../lib/companyAdmin";
import { useT } from "../../../../i18n/client";
import styles from "./page.module.css";

const RUTA = "/settings/admin-company/import";
const RUTA_PANEL = "/settings/admin-company";

/** El encabezado que el backend genera y espera (`_TEMPLATE_HEADER`). Se pinta
 *  literal: traducirlo haría que el parser no encontrara la columna de correo y
 *  rechazara el archivo entero. */
const ENCABEZADO = "correo,nombre,apellido";

/** Nombre del archivo descargado. En español, como la plantilla de ventas que
 *  ya existe en el repo, porque sus encabezados son los del backend. */
const NOMBRE_PLANTILLA = "plantilla_equipo.csv";

const MAX_KB = IMPORT_LIMITS.maxBytes / 1024;

/** La respuesta de la carga, SOLO si tiene la forma que esta pantalla sabe
 *  leer: el arreglo de filas y un total que es un número.
 *
 *  `_cuerpo()` en `api.js` devuelve `{}` ante cualquier cuerpo que no sea JSON
 *  —un 200 del proxy de Render con una página HTML dentro llega así, y el
 *  servicio free tarda hasta un minuto en despertar—. `{}` es verdadero, así que
 *  sin esta puerta la pantalla saltaba al paso 2, afirmaba "0 rows read from
 *  your file", pintaba las cinco categorías en 0 y dejaba habilitado el botón
 *  que SÍ sube el archivo de verdad. Y el mismo 200 malformado al confirmar
 *  hacía decir "0 of 0 rows became an invitation" después de que el backend
 *  pudo emitir 50.
 *
 *  Las DOS puertas usan esta función: la del resultado es la que miente después
 *  de haber escrito. `total` se exige numérico de verdad —y no `Number(x)`—
 *  porque el backend lo manda siempre como número (`len(...)`), así que
 *  cualquier otra cosa es un cuerpo que no se entendió.
 *
 *  Un archivo con encabezados y sin nadie es un cuerpo legítimo: `rows: []` con
 *  `total: 0` pasa la puerta. */
function tieneForma(res) {
  return Boolean(res)
    && Array.isArray(res.rows)
    && typeof res.total === "number"
    && Number.isFinite(res.total);
}

/** Las CINCO categorías de la previsualización, en este orden. `error` NO está:
 *  es la sexta y solo puede salir al confirmar (una fila válida cuya escritura
 *  falló). `counts` trae las seis siempre —`_zero_counts()`—, así que pintar las
 *  claves de `counts` ofrecería `error` como resultado posible de la
 *  previsualización, que es falso. */
const CATEGORIAS_PREVIA = ["invite", "join", "already", "rejected", "invalid"];

/** Las SEIS del resultado: ahí `error` sí puede aparecer. */
const CATEGORIAS_RESULTADO = [...CATEGORIAS_PREVIA, "error"];

export default function ImportMembersClient() {
  const t = useT("companyAdmin");
  const router = useRouter();

  const [ready, setReady] = useState(false);

  const [archivo, setArchivo] = useState(null);
  // Clave i18n del problema del archivo, o `null`. Un solo cajón para los tres
  // rechazos locales y para "todavía no elegiste archivo": así nunca se pintan
  // dos quejas sobre el mismo campo.
  const [rechazo, setRechazo] = useState(null);
  const [previa, setPrevia] = useState(null);
  const [resultado, setResultado] = useState(null);

  // Qué petición está en vuelo, no un booleano: con un booleano el aviso de
  // "leyendo tu archivo" saldría también mientras se descarga la plantilla.
  const [enCurso, setEnCurso] = useState(null);   // null | "template" | "preview" | "commit"
  // El guard de verdad es el REF, no el estado: dos `submit` en el mismo tick
  // leen el mismo estado viejo, y un `submit` ignora el atributo `disabled`.
  // Los dos mecanismos existen por separado, y cada uno tiene su prueba.
  const ocupadoRef = useRef(false);
  const [errorPlantilla, setErrorPlantilla] = useState(null);
  const [errorPrevia, setErrorPrevia] = useState(null);
  const [errorCommit, setErrorCommit] = useState(null);

  const campoRef = useRef(null);

  // Página privada: sin sesión, a login con ?next= (mismo patrón que el panel).
  //
  // El `setReady` pasa DESPUÉS de montar y no se deriva en el render: la sesión
  // vive en una cookie que el servidor no puede leer, así que calcularla al
  // renderizar daría un HTML de servidor que dice "sin sesión" y un cliente que
  // dice lo contrario (error de hidratación).
  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace(`/login?next=${RUTA}`);
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ver arriba
    setReady(true);
  }, [router]);

  /** Corre una petición: guard de reentrada, bandera de en vuelo, y el error al
   *  cajón que corresponda. Ninguna falla en silencio. */
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

  /** La plantilla la genera el BACKEND y se descarga tal cual. Escribir el
   *  encabezado aquí crearía una segunda fuente de verdad que, al separarse de
   *  la del backend, produce archivos que el parser rechaza entero. */
  const descargarPlantilla = useCallback(() => {
    correr("template", async () => {
      const csv = await getImportTemplate();
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = NOMBRE_PLANTILLA;
      a.click();
      URL.revokeObjectURL(url);
    }, setErrorPlantilla);
  }, [correr]);

  /** Elegir un archivo descarta TODO lo que se sabía del anterior.
   *
   *  El `commit` vuelve a subir el archivo, así que una previsualización del
   *  archivo A viva junto al archivo B en el campo haría que confirmar
   *  importara B mostrando la previsualización de A. */
  const elegirArchivo = useCallback((ev) => {
    const archivos = ev.target.files;
    const elegido = (archivos && archivos[0]) || null;
    setPrevia(null);
    setResultado(null);
    setErrorPrevia(null);
    setErrorCommit(null);
    // `fileRejectionKey(null)` devuelve `null`: sin archivo elegido no hay de
    // qué quejarse todavía.
    const problema = fileRejectionKey(elegido);
    setRechazo(problema);
    setArchivo(problema ? null : elegido);
  }, []);

  const previsualizar = useCallback((e) => {
    if (e) e.preventDefault();
    // Ya hay una queja debajo del campo: no se apila una segunda.
    if (rechazo) return;
    if (!archivo) {
      setRechazo("import.noFile");
      return;
    }
    correr("preview", async () => {
      setResultado(null);
      const res = await previewMembersImport(archivo);
      // Sin `detail` ni `status`: `errorMessageFor` da el mensaje genérico, que
      // es exactamente lo que se sabe de un cuerpo que no se entiende. Y el
      // paso 1 se queda en pantalla, así que volver a intentarlo es un clic.
      if (!tieneForma(res)) throw new Error("");
      setPrevia(res);
    }, setErrorPrevia);
  }, [archivo, rechazo, correr]);

  const confirmar = useCallback((e) => {
    if (e) e.preventDefault();
    if (!archivo || !previa) return;
    correr("commit", async () => {
      const res = await commitMembersImport(archivo);
      // La MISMA puerta, y aquí es la que importa: pintar un resultado que no
      // se entendió afirmaría "0 of 0 rows became an invitation" sobre una
      // escritura que el backend pudo hacer entera. Si el cuerpo no se
      // entiende, no se sabe qué pasó, y eso es lo que se dice.
      if (!tieneForma(res)) throw new Error("");
      setResultado(res);
      setPrevia(null);
    }, setErrorCommit);
  }, [archivo, previa, correr]);

  /** Empezar de nuevo: el archivo del campo también se limpia, porque dejarlo
   *  ahí con el estado ya borrado mostraría un nombre de archivo elegido y un
   *  botón que no puede hacer nada. */
  const empezarDeNuevo = useCallback(() => {
    setArchivo(null);
    setRechazo(null);
    setPrevia(null);
    setResultado(null);
    setErrorPrevia(null);
    setErrorCommit(null);
    if (campoRef.current) {
      campoRef.current.value = "";
      campoRef.current.focus();
    }
  }, []);

  if (!ready) return null;

  const ocupado = Boolean(enCurso);
  const filasPrevia = Array.isArray(previa && previa.rows) ? previa.rows : [];
  const filasResultado = Array.isArray(resultado && resultado.rows) ? resultado.rows : [];
  // Los nombres salen de las FILAS, que es el único sitio donde el backend dice
  // quién es quién: `email_failed` es solo el conteo.
  const sinCorreo = filasResultado
    .filter((f) => f && f.email_sent === false)
    .map((f) => f.email);

  return (
    <div className={styles.wrapper}>
      <p className={styles.intro}>{t("import.intro")}</p>
      <p className={styles.backRow}>
        <a className={styles.link} href={RUTA_PANEL}>{t("import.backToTeam")}</a>
      </p>

      {/* ── Paso 1 ─────────────────────────────────────────────────────── */}
      {!resultado && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>{t("import.step1Title")}</h2>

          <h3 className={styles.blockTitle}>{t("import.columnsTitle")}</h3>
          <p className={styles.muted}>{t("import.columnsBody")}</p>
          {/* Literal y en monoespaciada: es un dato técnico (claude.md §2.2), y
              es lo que el jefe tiene que copiar tal cual. */}
          <p className={styles.header}><code>{ENCABEZADO}</code></p>
          <p className={styles.muted}>{t("import.columnsOnlyEmail")}</p>
          <p className={styles.muted}>{t("import.separators")}</p>
          {/* Los DOS topes salen de `IMPORT_LIMITS`, el mismo sitio del que
              salen el rechazo local y las firmas de los 422 del backend: un
              tope escrito a mano en la copia deja de ser verdad en cuanto el
              backend mueva el suyo. */}
          <p className={styles.muted}>
            {t("import.limits", { maxRows: IMPORT_LIMITS.maxRows, maxKb: MAX_KB })}
          </p>

          <div className={styles.actions}>
            <button
              type="button"
              className="btn-ghost"
              onClick={descargarPlantilla}
              disabled={ocupado}
            >
              {t("import.downloadTemplate")}
            </button>
          </div>
          <p className={styles.muted}>{t("import.templateHint")}</p>
          {errorPlantilla && (
            <p className={styles.error} role="alert">
              {errorMessageFor(errorPlantilla, t)}
            </p>
          )}

          <form className={styles.form} onSubmit={previsualizar}>
            <div className={styles.field}>
              {/* Etiqueta asociada de verdad, no un placeholder
                  (claude.md §5.5). */}
              <label className={styles.fieldLabel} htmlFor="import-file">
                {t("import.chooseFile")}
                <span className={styles.requerido} aria-hidden="true"> *</span>
                <span className="sr-only"> ({t("accept.required")})</span>
              </label>
              <input
                ref={campoRef}
                className={styles.file}
                id="import-file"
                name="file"
                type="file"
                /* Solo .csv: el backend no tiene rama de ZIP en esta carga. */
                accept=".csv,text/csv"
                required
                onChange={elegirArchivo}
                aria-invalid={rechazo ? "true" : undefined}
                aria-describedby={rechazo ? "import-file-error" : undefined}
              />
              {/* El error va DEBAJO del campo, nunca en un alert()
                  (claude.md §5.5). */}
              {rechazo && (
                <p className={styles.fieldError} id="import-file-error" role="alert">
                  {t(rechazo, { maxKb: MAX_KB })}
                </p>
              )}
            </div>

            {/* El botón del paso en curso es el ÚNICO dorado de la pantalla
                (claude.md §2.1, máximo uno por vista). Con una
                previsualización en pantalla, el dorado pasa a confirmar y este
                desaparece: el archivo ya está leído. */}
            {!previa && (
              <div className={styles.actions}>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={ocupado || Boolean(rechazo)}
                >
                  {t("import.preview")}
                </button>
              </div>
            )}
            {enCurso === "preview" && (
              <p className={styles.muted} role="status">{t("import.previewWorking")}</p>
            )}
            {errorPrevia && (
              <p className={styles.error} role="alert">
                {errorMessageFor(errorPrevia, t)}
              </p>
            )}
          </form>
        </section>
      )}

      {/* ── Paso 2: qué pasaría. Nada escrito todavía ───────────────────── */}
      {previa && !resultado && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>{t("import.step2Title")}</h2>
          <p className={styles.muted}>{t("import.previewIntro")}</p>
          <p className={styles.total}>
            {t("import.previewTotal", { total: Number(previa.total) || 0 })}
          </p>

          <Resumen
            t={t}
            etiqueta={t("import.previewSummaryLabel")}
            categorias={CATEGORIAS_PREVIA}
            counts={previa.counts}
          />

          <TablaDeFilas
            t={t}
            filas={filasPrevia}
            leyenda={t("import.previewTableCaption")}
            columna={t("import.colOutcome")}
          />
          <p className={styles.muted}>{t("import.rowsNote")}</p>

          {/* Un formulario de verdad, para que el doble envío se pueda probar
              con un submit: un submit ignora el `disabled` del botón, así que
              el guard de reentrada del manejador es el otro mecanismo. */}
          <form className={styles.form} onSubmit={confirmar}>
            {errorCommit && (
              <p className={styles.error} role="alert">
                {errorMessageFor(errorCommit, t)}
              </p>
            )}
            <div className={styles.actions}>
              <button type="submit" className="btn-primary" disabled={ocupado}>
                {enCurso === "commit" ? t("import.confirmWorking") : t("import.confirm")}
              </button>
              <button
                type="button"
                className={styles.link}
                onClick={empezarDeNuevo}
                disabled={ocupado}
              >
                {t("import.startOver")}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* ── El resultado, fila por fila ─────────────────────────────────── */}
      {resultado && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>{t("import.resultTitle")}</h2>
          <p className={styles.total}>
            {t("import.resultIssued", {
              issued: Number(resultado.invitations_issued) || 0,
              total: Number(resultado.total) || 0,
            })}
          </p>
          {/* `membership_changed` es SIEMPRE falso: nadie quedó dentro del
              equipo por esta carga. Decirlo aquí, y no en letra pequeña. */}
          <p className={styles.muted}>{t("import.notYetMembers")}</p>

          {/* Las invitaciones cuyo correo no salió. En `.notice` y no en el
              color de peligro: esa gente SÍ quedó invitada y su enlace sirve;
              pintarlo en rojo haría pensar que no se invitó a nadie. */}
          {sinCorreo.length > 0 && (
            <div className={styles.notice} role="status">
              <h3 className={styles.blockTitle}>{t("import.emailFailedTitle")}</h3>
              <ul className={styles.emailList}>
                {sinCorreo.map((correo) => (
                  <li key={correo} className={styles.emailItem}>{correo}</li>
                ))}
              </ul>
              <p className={styles.noticeBody}>{t("import.emailFailedBody")}</p>
            </div>
          )}

          <Resumen
            t={t}
            etiqueta={t("import.resultSummaryLabel")}
            categorias={CATEGORIAS_RESULTADO}
            counts={resultado.counts}
          />

          <TablaDeFilas
            t={t}
            filas={filasResultado}
            leyenda={t("import.resultTableCaption")}
            columna={t("import.colResult")}
            conCorreo
          />
          <p className={styles.muted}>{t("import.rowsNote")}</p>

          <div className={styles.actions}>
            <a className="btn-primary" href={RUTA_PANEL}>{t("import.backToTeam")}</a>
            <button type="button" className={styles.link} onClick={empezarDeNuevo}>
              {t("import.importAnother")}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

/** Cuántas filas caen en cada categoría, en palabras del jefe.
 *
 *  Las categorías llegan en una LISTA EXPLÍCITA y no de las claves de `counts`:
 *  `counts` trae las seis siempre, y la sexta (`error`) no es un resultado
 *  posible de la previsualización. Los ceros se pintan a propósito: saber que
 *  ninguna fila va a quedar fuera es parte de lo que se viene a comprobar. */
function Resumen({ t, etiqueta, categorias, counts }) {
  const c = counts && typeof counts === "object" ? counts : {};
  return (
    <ul className={styles.summary} aria-label={etiqueta}>
      {categorias.map((categoria) => (
        <li key={categoria} className={styles.summaryItem}>
          <span className={styles.summaryLabel}>{t(previewCategoryKey(categoria))}</span>
          <span className={styles.summaryCount}>{Number(c[categoria]) || 0}</span>
        </li>
      ))}
    </ul>
  );
}

/** Fila por fila: su número, su correo y qué (va a) pasar con ella.
 *
 *  Fila por fila y no un solo número porque la importación es PARCIAL: cada
 *  fila se persiste sola y una que falle no revierte las demás.
 *
 *  `conCorreo` añade si el correo salió, que el backend solo manda en las filas
 *  `invite` y `join` de la confirmación: de ahí el `!== undefined`, que es
 *  exactamente su contrato. */
function TablaDeFilas({ t, filas, leyenda, columna, conCorreo = false }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <caption className="sr-only">{leyenda}</caption>
        <thead>
          <tr>
            <th scope="col">{t("import.colRow")}</th>
            <th scope="col">{t("import.colEmail")}</th>
            <th scope="col">{columna}</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, i) => (
            <tr key={`${fila.row}:${fila.email || i}`}>
              <th scope="row" className={styles.rowNumber}>{fila.row}</th>
              <td className={styles.rowEmail}>{fila.email}</td>
              <td>
                <span className={styles.outcome}>{t(previewCategoryKey(fila.result))}</span>
                {conCorreo && fila.email_sent !== undefined && (
                  <span className={styles.emailFlag}>
                    {t(fila.email_sent ? "import.emailSent" : "import.emailNotSent")}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
