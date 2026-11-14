"use client";

/**
 * CatalogPicker — qué cursos entrega la membresía individual.
 *
 * Es la parte de la consola de Distinct que decide el producto: la lista de
 * `GET /api/pay/admin/catalogo/` con su casilla, y `PUT` con la SELECCIÓN
 * COMPLETA. No se mandan diferencias a propósito: el contrato del endpoint es
 * "esto es el catálogo" (`guardar_el_catalogo` reemplaza), y dos pestañas
 * abiertas mandando diferencias se pisan.
 *
 * CUATRO COSAS QUE ESTA PANTALLA EXISTE PARA QUE NO PASEN, y ninguna es
 * decorativa: las cuatro son dinero cobrado por algo que no se entrega.
 *
 * 1. **Regalar el contenido de un cliente.** La mitad de las categorías de
 *    Moodle son de un cliente concreto y el NOMBRE del curso no lo dice. El
 *    caso medido: `ALIMENTOS Y BEBIDAS` es de HOTELES OPTIMY y solo su código
 *    (`OPTFB`) lo delata. Por eso la categoría se pinta junto a cada curso, con
 *    su código entre paréntesis cuando viene; y cuando Moodle no reportó
 *    categoría se dice que no se sabe en vez de inventarla.
 *
 * 2. **Cobrar por un curso que ya no existe.** `incluidos_sin_curso_en_moodle`
 *    son cursos marcados que Moodle ya no reporta. La matrícula manda el
 *    catálogo entero en UNA llamada, así que uno muerto la hace fallar entera y
 *    deja sin NINGÚN curso a todos los que paguen desde ese momento. Se pintan
 *    con su nombre: sin eso, el curso culpable no se nombra en ninguna parte.
 *
 * 3. **Cobrar por un curso oculto.** `incluidos_ocultos_en_moodle` son
 *    marcados que Moodle reporta ocultos: ahí la matrícula se "confirma" (la
 *    relectura va con token de admin, que sí los ve) y la persona no ve nada.
 *    Marcar uno oculto está prohibido y el `PUT` lo rechaza con 400
 *    `curso_oculto`; aquí además se bloquea el guardado antes de pedirlo, y el
 *    mensaje nombra el curso y dice qué hacer (publicarlo en Moodle).
 *
 * 4. **Una lista vacía que parezca "Moodle no tiene cursos".** El 503 con
 *    `motivo: "moodle_no_responde"` significa que no se pudo preguntar. Se dice
 *    y no se pinta ninguna lista: falla cerrado.
 *
 * El número de incluidos es el GUARDADO (lo que se entrega y por lo que se
 * cobra hoy), no la selección en pantalla: por eso el aviso de catálogo vacío
 * sigue siendo cierto mientras no se pulse Guardar.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { getCatalogoDeMembresia, guardarCatalogoDeMembresia } from "../lib/api";
import { useT } from "../i18n/client";
import styles from "./CatalogPicker.module.css";

const FASE = { CARGANDO: "cargando", LISTO: "listo", FALLO: "fallo" };

/** El motivo con el que el backend separa "no se pudo preguntar a Moodle" de
 *  cualquier otro fallo. Se compara el campo, nunca el texto. */
const MOODLE_NO_RESPONDE = "moodle_no_responde";

/** La categoría de un curso tal como se puede afirmar: con su código entre
 *  paréntesis solo cuando viene, y "no se sabe" cuando Moodle no la reportó. */
function categoriaDe(t, curso) {
  if (!curso.categoria) return t("catalog.unknownCategory");
  return curso.categoria_codigo
    ? `${curso.categoria} (${curso.categoria_codigo})`
    : curso.categoria;
}

export default function CatalogPicker() {
  const t = useT("pay");

  const ocupadoRef = useRef(false);
  const [fase, setFase] = useState(FASE.CARGANDO);
  const [vista, setVista] = useState(null);
  const [marcados, setMarcados] = useState([]);
  const [falloDeCarga, setFalloDeCarga] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [falloAlGuardar, setFalloAlGuardar] = useState(null);

  /** La selección en pantalla nace de lo que el backend dice que está incluido. */
  const aplicar = useCallback((datos) => {
    const cursos = Array.isArray(datos && datos.cursos) ? datos.cursos : [];
    setVista({
      cursos,
      incluidos: typeof datos.incluidos === "number" ? datos.incluidos : 0,
      sinCurso: Array.isArray(datos.incluidos_sin_curso_en_moodle)
        ? datos.incluidos_sin_curso_en_moodle : [],
      ocultos: Array.isArray(datos.incluidos_ocultos_en_moodle)
        ? datos.incluidos_ocultos_en_moodle : [],
    });
    setMarcados(cursos.filter((c) => c.incluido).map((c) => c.moodle_course_id));
  }, []);

  const cargar = useCallback(async () => {
    setFase(FASE.CARGANDO);
    setFalloDeCarga(null);
    setGuardado(false);
    setFalloAlGuardar(null);
    try {
      aplicar(await getCatalogoDeMembresia());
      setFase(FASE.LISTO);
    } catch (err) {
      setFalloDeCarga(err);
      setFase(FASE.FALLO);
    }
  }, [aplicar]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial
    cargar();
  }, [cargar]);

  const alternar = (id) => {
    setGuardado(false);
    setFalloAlGuardar(null);
    setMarcados((actual) =>
      actual.includes(id) ? actual.filter((x) => x !== id) : [...actual, id]);
  };

  /** `12 (Bartender)`, igual que los nombra el backend. Un id que esta pantalla
   *  no conoce viaja solo: inventarle un nombre sería peor que no darlo. */
  const nombrar = useCallback((ids) => (ids || []).map((id) => {
    const curso = (vista ? vista.cursos : []).find((c) => c.moodle_course_id === id);
    return curso ? `${id} (${curso.nombre})` : String(id);
  }).join(", "), [vista]);

  if (fase === FASE.CARGANDO) {
    return (
      <section className={styles.card} aria-busy="true">
        <h2 className={styles.cardTitle}>{t("catalog.title")}</h2>
        <p className={styles.muted}>{t("catalog.loading")}</p>
      </section>
    );
  }

  if (fase === FASE.FALLO) {
    // Moodle caído tiene su propio mensaje: "no se pudo preguntar" no es "no hay
    // cursos", y una lista vacía haría concluir lo segundo.
    const esMoodle = falloDeCarga && falloDeCarga.motivo === MOODLE_NO_RESPONDE;
    return (
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>{t("catalog.title")}</h2>
        <p className={styles.error} role="alert">
          {esMoodle ? t("catalog.loadFailedMoodle") : t("loadFailedBody")}
        </p>
        <button type="button" className="btn-ghost" onClick={cargar}>{t("retry")}</button>
      </section>
    );
  }

  const ocultosMarcados = vista.cursos.filter(
    (c) => !c.visible && marcados.includes(c.moodle_course_id));

  async function guardar() {
    // El guardado se bloquea con un curso oculto marcado: el `PUT` lo
    // rechazaría igual, y es mejor nombrarlo antes que gastar la petición.
    if (ocupadoRef.current || ocultosMarcados.length > 0) return;
    ocupadoRef.current = true;
    setGuardando(true);
    setGuardado(false);
    setFalloAlGuardar(null);
    try {
      // La selección COMPLETA y ordenada, nunca las diferencias.
      aplicar(await guardarCatalogoDeMembresia([...marcados].sort((a, b) => a - b)));
      setGuardado(true);
    } catch (err) {
      setFalloAlGuardar(err);
    }
    ocupadoRef.current = false;
    setGuardando(false);
  }

  /** El mensaje de un fallo al guardar, por ESTADO y por `motivo`, nunca por el
   *  texto del backend. Los dos 400 nombran el curso culpable. */
  function mensajeDeFallo(err) {
    const status = err && err.status;
    if (status === 400 && err.motivo === "curso_oculto") {
      return t("catalog.errHidden", { courses: nombrar(err.cursosOcultos) });
    }
    if (status === 400 && err.motivo === "curso_desconocido") {
      return t("catalog.errUnknown", { courses: nombrar(err.cursosDesconocidos) });
    }
    if (status === 503 && err.motivo === MOODLE_NO_RESPONDE) return t("catalog.loadFailedMoodle");
    if (status === 401) return t("errSession");
    if (status === 403) return t("catalog.errForbidden");
    return t("catalog.errSave");
  }

  return (
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>{t("catalog.title")}</h2>
      <p className={styles.muted}>{t("catalog.body")}</p>
      <p className={styles.data}>{t(vista.incluidos === 1 ? "catalog.includedCountOne" : "catalog.includedCount", { count: vista.incluidos })}</p>

      {vista.incluidos === 0 && (
        <p className={styles.notice} role="status">{t("catalog.noneIncluded")}</p>
      )}

      {vista.sinCurso.length > 0 && (
        <section className={styles.warning}>
          <h3 className={styles.warningTitle}>{t("catalog.missingTitle")}</h3>
          <p className={styles.muted}>{t("catalog.missingBody")}</p>
          <ul className={styles.problemList}>
            {vista.sinCurso.map((c) => (
              <li key={c.moodle_course_id} className={styles.problemItem}>
                <span className={styles.data}>{c.moodle_course_id}</span> {c.nombre}
              </li>
            ))}
          </ul>
        </section>
      )}

      {vista.ocultos.length > 0 && (
        <section className={styles.warning}>
          <h3 className={styles.warningTitle}>{t("catalog.hiddenTitle")}</h3>
          <p className={styles.muted}>{t("catalog.hiddenBody")}</p>
          <ul className={styles.problemList}>
            {vista.ocultos.map((c) => (
              <li key={c.moodle_course_id} className={styles.problemItem}>
                <span className={styles.data}>{c.moodle_course_id}</span> {c.nombre}
              </li>
            ))}
          </ul>
        </section>
      )}

      <ul className={styles.courseList}>
        {vista.cursos.map((curso) => {
          const id = `catalogo-curso-${curso.moodle_course_id}`;
          return (
            <li key={curso.moodle_course_id} className={styles.courseItem}>
              <input
                id={id}
                className={styles.checkbox}
                type="checkbox"
                checked={marcados.includes(curso.moodle_course_id)}
                onChange={() => alternar(curso.moodle_course_id)}
                disabled={guardando}
              />
              <label htmlFor={id} className={styles.courseLabel}>
                <span className={styles.courseName}>{curso.nombre}</span>
                {/* La categoría EN MOODLE, con su código cuando viene: es la
                    única señal de que un curso es de un cliente. */}
                <span className={styles.category}>{categoriaDe(t, curso)}</span>
                {!curso.visible && (
                  <span className={styles.flag}>{t("catalog.notVisibleFlag")}</span>
                )}
              </label>
            </li>
          );
        })}
      </ul>

      {ocultosMarcados.length > 0 && (
        <p className={styles.error} role="alert">
          {t("catalog.errHidden", {
            courses: nombrar(ocultosMarcados.map((c) => c.moodle_course_id)),
          })}
        </p>
      )}

      <div className={styles.block}>
        <button
          type="button"
          className="btn-primary"
          onClick={guardar}
          disabled={guardando || ocultosMarcados.length > 0}
        >
          {guardando ? t("catalog.saving") : t("catalog.save")}
        </button>
      </div>

      {guardado && <p className={styles.notice} role="status">{t("catalog.saved")}</p>}
      {falloAlGuardar && (
        <p className={styles.error} role="alert">{mensajeDeFallo(falloAlGuardar)}</p>
      )}
    </section>
  );
}
