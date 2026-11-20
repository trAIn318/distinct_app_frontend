"use client";

/**
 * TrainingClient — cubrir un curso a varias personas del equipo, de una vez.
 *
 * elegir curso → marcar personas → una sola acción → una fila por persona.
 *
 * LO QUE ESTA PANTALLA SABE DEL COSTE (medido contra el servidor real):
 *  - Cubrir se manda en TANDAS DE 10 (`TAMANO_DE_TANDA`), una tras otra, con el
 *    avance a la vista. El servidor acepta 50, pero 50 son hasta 203 llamadas y
 *    174 s contra un corte a los 180 s; 10 son ~21 llamadas y ~18 s. El tope de
 *    50 del servidor es la red, no el camino normal.
 *  - La gente se lista de 10 en 10 por la misma razón: saber quién ya tiene un
 *    curso cuesta UNA llamada por persona a la vista.
 *
 * QUÉ SE SABE DE QUIÉN YA ESTÁ CUBIERTO: se pregunta al abrir el curso y al
 * cambiar de página, y SOLO por las personas de la página a la vista (el tope es
 * 10 por petición y cuesta una llamada por persona). Lo que respondieron cubrir y
 * dejar de cubrir en esta visita manda sobre una respuesta que llegue tarde, y
 * todo se olvida al cambiar de curso. La respuesta tiene TRES estados:
 *   covered / not_covered → se sabe.
 *   unknown (o cualquier cosa que no reconozcamos, o la petición entera caída)
 *     → NO SE PUDO PREGUNTAR. Se pinta "no se pudo comprobar" y NO se bloquea
 *     nada, y NUNCA se lee como "sin cubrir": esa persona podría estar cubierta.
 *     Se vuelve a preguntar al volver a la página.
 *
 * LO QUE UNA FILA "FALLIDA" NO SIEMPRE ES (ver `lib/training.js`):
 *  - `no_se_intento_por_tiempo` → NO se tocó: pendiente, no error.
 *  - `error_inesperado` y `..._no_lo_confirma` → pudo escribirse: por confirmar.
 *  Reintentar ambas es seguro (matricular es idempotente) y tiene su botón
 *  aparte, que NO incluye los rechazos de verdad.
 *
 * NUNCA SE PINTA EL TEXTO DEL SERVIDOR. El 503 lo dice con el nombre del
 * proveedor de cursos y el jefe no sabe qué es: las tres funciones de `api.js`
 * lanzan un Error con `kind`, y la copia sale de i18n por ese `kind`.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  cubrirCurso,
  dejarDeCubrirCurso,
  getCatalogoDeFormacion,
  getCoberturaDeCurso,
  getCompanyMembers,
} from "../../../../lib/api";
import { isAuthenticated } from "../../../../lib/session";
import {
  ROW_STATUS,
  displayNameFor,
  memberStatus,
} from "../../../../lib/companyAdmin";
import {
  DET_NO_SE_ENVIO,
  DET_SIN_RESPUESTA,
  TAMANO_DE_TANDA,
  clasificarFila,
  reintentables,
} from "../../../../lib/training";
import { useT } from "../../../../i18n/client";
import styles from "./page.module.css";

const RUTA = "/settings/admin-company/training";
const RUTA_PANEL = "/settings/admin-company";

/** Los `kind` que `api.js` puede lanzar; cualquier otro cae en `generico`. */
const KINDS = ["sin_lectura", "red", "sesion", "permiso", "pedido", "generico", "ilegible"];
const kindDe = (err) => (err && KINDS.includes(err.kind) ? err.kind : "generico");

/** Estos tres dicen que el servidor NO escribió nada: la tanda queda "sin
 *  enviar". Con los demás (sin red, 5xx, cuerpo ilegible) la petición pudo
 *  haberse ejecutado: la tanda queda "por confirmar". */
const SIN_ESCRIBIR = new Set(["sin_lectura", "pedido", "permiso", "sesion"]);

const TIPOS = ["ok", "neutro", "pendiente", "incierto", "noatendida", "fallo", "desconocido"];

function trocear(lista, n) {
  const tandas = [];
  for (let i = 0; i < lista.length; i += n) tandas.push(lista.slice(i, i + n));
  return tandas;
}

/** Pone `nuevas` en su sitio por `usr_id`; las que no estaban, al final. */
function fusionar(actuales, nuevas) {
  const salida = [...actuales];
  for (const f of nuevas) {
    const i = salida.findIndex((x) => x.usr_id === f.usr_id);
    if (i >= 0) salida[i] = f;
    else salida.push(f);
  }
  return salida;
}

/** Se decide con el mismo helper que usa el panel de al lado (`memberStatus`),
 *  no con una segunda lectura de `active`.
 *
 *  La regla es ASIMÉTRICA a propósito: al CUBRIR se bloquea (no se gasta un cupo
 *  de curso en quien no puede entrar), pero al DEJAR de cubrir se permite.
 *  Quien se desactivó DESPUÉS de ser cubierto sigue ocupando un cupo, y liberar
 *  un cupo que nadie va a usar es justo lo que el jefe necesita. */
const estaDesactivada = (m) => memberStatus(m) === ROW_STATUS.DEACTIVATED;

/** ¿Puede esta persona recibir esta acción ahora? UNA sola regla, que usan las
 *  casillas, la poda de la selección y el filtro de lo que de verdad viaja en
 *  cubrir, dejar de cubrir y reintentar. `m` puede faltar (se reintenta a
 *  alguien de otra página que ya no se tiene a la vista): entonces solo manda la
 *  cobertura.
 *
 *  Quien ya está cubierto no se cubre; quien ya no lo está no se descubre; y quien
 *  está desactivado no se cubre (ver `estaDesactivada`). */
function puede(accion, m, cobertura, id) {
  if (accion === "cubrir") {
    if (m && estaDesactivada(m)) return false;
    return cobertura[id] !== true;
  }
  return cobertura[id] !== false;
}

/** Texto de la lista de gente que no cargó. Nunca el del servidor: se decide por
 *  el estado HTTP (esta función no puede leer el mensaje) y la copia es propia. */
function claveErrorGente(err) {
  const status = err && err.status;
  if (status === 401) return "loadError.sesion";
  if (status === 403) return "loadError.permiso";
  if (typeof status !== "number") return "loadError.red"; // no llegó respuesta
  return "peopleError";
}

export default function TrainingClient() {
  const t = useT("training");
  const tPanel = useT("companyAdmin");
  const router = useRouter();

  const [ready, setReady] = useState(false);

  const [catalogo, setCatalogo] = useState({ estado: "cargando" }); // cargando | ok | error
  const [cursoId, setCursoId] = useState("");
  const [modo, setModo] = useState("cubrir"); // cubrir | dejar

  const [offset, setOffset] = useState(0);
  const [gente, setGente] = useState({ estado: "vacio" }); // vacio | cargando | ok | error
  // usr_id → email de quienes están marcados. Sobrevive al cambio de página.
  const [seleccion, setSeleccion] = useState(() => new Map());
  // usr_id → true (cubierta) | false (sin cubrir) | "unknown" (no se pudo
  // preguntar). Ausente = todavía no se ha preguntado, o no volvió fila.
  const [cobertura, setCobertura] = useState({});
  // Estado de la última pregunta de cobertura de la página a la vista.
  const [cobEstado, setCobEstado] = useState("idle"); // idle | cargando | error
  const [intentoCob, setIntentoCob] = useState(0);
  // Espejo de `cobertura` para leerlo dentro del efecto sin que el efecto se
  // vuelva a disparar con cada respuesta (un `unknown` lo haría en bucle).
  const coberturaRef = useRef({});

  const [enCurso, setEnCurso] = useState(null); // null | "cubrir" | "dejar"
  const [progreso, setProgreso] = useState(null); // {i, n}
  const [filas, setFilas] = useState([]);
  const [accionUlt, setAccionUlt] = useState(null);
  const [errorRun, setErrorRun] = useState(null);
  const [confirmando, setConfirmando] = useState(false);
  // "No había nada que enviar": se dijo en vez de volver en silencio.
  const [avisoNada, setAvisoNada] = useState(false);

  // El guard de verdad es el REF: dos clics en el mismo tick leen el mismo
  // estado viejo.
  const ocupadoRef = useRef(false);
  const dialogoRef = useRef(null);
  const botonDejarRef = useRef(null);
  const tituloGenteRef = useRef(null);
  // La última versión que se vio de cada persona (id → miembro). La selección
  // viaja entre páginas y una persona puede cambiar (desactivarse) entre dos
  // cargas: lo que viaja se decide con lo último que se supo.
  const vistosRef = useRef(new Map());

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace(`/login?next=${RUTA}`);
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- la sesión vive en una cookie: se lee tras montar
    setReady(true);
  }, [router]);

  const cargarCatalogo = useCallback(async () => {
    setCatalogo({ estado: "cargando" });
    try {
      const datos = await getCatalogoDeFormacion();
      setCatalogo({ estado: "ok", datos });
    } catch (err) {
      setCatalogo({ estado: "error", kind: kindDe(err) });
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial del catálogo
    cargarCatalogo();
  }, [ready, cargarCatalogo]);

  // La gente se pide SOLO con un curso elegido, y solo la página a la vista.
  useEffect(() => {
    if (!ready || !cursoId) return undefined;
    let vigente = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- petición por página
    setGente({ estado: "cargando" });
    getCompanyMembers({ limit: TAMANO_DE_TANDA, offset })
      .then((datos) => {
        if (!vigente) return;
        const members = Array.isArray(datos && datos.members) ? datos.members : [];
        for (const m of members) vistosRef.current.set(m.id, m);
        const invitaciones = Array.isArray(datos && datos.invitations) ? datos.invitations.length : 0;
        setGente({
          estado: "ok", members, invitaciones,
          total: Number(datos && datos.total) || members.length,
        });
      })
      .catch((err) => {
        if (vigente) setGente({ estado: "error", err });
      });
    return () => { vigente = false; };
  }, [ready, cursoId, offset]);

  useEffect(() => {
    coberturaRef.current = cobertura;
  }, [cobertura]);

  // La cobertura se pide al abrir el curso y al cambiar de página, solo de las
  // personas a la vista y solo de las que no se sabe (ni cubierta ni sin cubrir).
  useEffect(() => {
    if (!ready || !cursoId || gente.estado !== "ok") return undefined;
    // El servidor acepta 10 por petición (con 11 responde 400, que aquí se vería
    // como "todo desconocido": un diagnóstico falso). La página es de 10, pero el
    // tope no puede depender de que nadie la agrande.
    const ids = gente.members
      .map((m) => m.id)
      .filter((id) => {
        const v = coberturaRef.current[id];
        return v === undefined || v === "unknown";
      })
      .slice(0, TAMANO_DE_TANDA);
    if (ids.length === 0) {
      setCobEstado("idle");
      return undefined;
    }
    let vigente = true;
    setCobEstado("cargando");
    // Una respuesta SOLO rellena lo que aún no se sabe: lo que cubrir o dejar
    // de cubrir ya dijeron en esta visita es más reciente que una pregunta hecha antes.
    const rellenar = (nuevos) => setCobertura((prev) => {
      const sig = { ...prev };
      for (const [id, v] of Object.entries(nuevos)) {
        if (sig[id] === undefined || sig[id] === "unknown") sig[id] = v;
      }
      return sig;
    });
    getCoberturaDeCurso(Number(cursoId), ids)
      .then((r) => {
        if (!vigente) return;
        const nuevos = {};
        for (const fila of r.filas) {
          // Solo `covered` y `not_covered` son respuestas. `unknown`, y cualquier
          // cosa que no conozcamos, es "no se pudo preguntar": NUNCA "sin cubrir".
          if (fila.resultado === "covered") nuevos[fila.usr_id] = true;
          else if (fila.resultado === "not_covered") nuevos[fila.usr_id] = false;
          else nuevos[fila.usr_id] = "unknown";
        }
        rellenar(nuevos);
        setCobEstado("idle");
      })
      .catch(() => {
        if (!vigente) return;
        // Toda la página queda desconocida, no "sin cubrir".
        rellenar(Object.fromEntries(ids.map((id) => [id, "unknown"])));
        setCobEstado("error");
      });
    return () => { vigente = false; };
  }, [ready, cursoId, gente, intentoCob]);

  const reiniciarVisita = useCallback(() => {
    setOffset(0);
    setSeleccion(new Map());
    setCobertura({});
    setCobEstado("idle");
    setFilas([]);
    setAccionUlt(null);
    setErrorRun(null);
    setConfirmando(false);
    setProgreso(null);
    setAvisoNada(false);
    vistosRef.current = new Map();
  }, []);

  const elegirCurso = useCallback((ev) => {
    reiniciarVisita();
    setGente({ estado: "vacio" });
    setCursoId(ev.target.value);
  }, [reiniciarVisita]);

  const elegirModo = useCallback((nuevo) => {
    setModo(nuevo);
    setSeleccion(new Map());
    setConfirmando(false);
    setAvisoNada(false);
  }, []);

  // La selección es una fuente de verdad MÁS, y sobrevive a lo que invalida a las
  // otras (la cobertura que llega, la lista que se recarga, el modo): se poda
  // cuando cambia cualquiera de ellas. Sin esto quedan casillas apagadas pero
  // marcadas, un contador inflado, y alguien desactivado entre dos cargas que
  // todavía viaja.
  useEffect(() => {
    setSeleccion((prev) => {
      let cambio = false;
      const sig = new Map();
      for (const [id, email] of prev) {
        if (puede(modo, vistosRef.current.get(id), cobertura, id)) sig.set(id, email);
        else cambio = true;
      }
      return cambio ? sig : prev;
    });
  }, [cobertura, gente, modo]);

  /** ¿Se puede marcar? Quien ya está cubierto no (al cubrir); quien ya no lo
   *  está tampoco (al dejar de cubrir); y quien está desactivado no al CUBRIR
   *  (reactivarlo es un clic en la pantalla de al lado; gastar un cupo en
   *  silencio no), pero SÍ al dejar de cubrir (ver `estaDesactivada`). */
  const marcable = useCallback((m) => {
    if (enCurso || confirmando) return false;
    return puede(modo, m, cobertura, m.id);
  }, [enCurso, confirmando, modo, cobertura]);

  const alternar = useCallback((m) => {
    setAvisoNada(false);
    setSeleccion((prev) => {
      const sig = new Map(prev);
      if (sig.has(m.id)) sig.delete(m.id);
      else sig.set(m.id, m.email);
      return sig;
    });
  }, []);

  const members = gente.estado === "ok" ? gente.members : [];
  const delaPagina = members.filter((m) => marcable(m));
  const todosMarcados = delaPagina.length > 0 && delaPagina.every((m) => seleccion.has(m.id));

  const alternarPagina = useCallback(() => {
    setAvisoNada(false);
    setSeleccion((prev) => {
      const sig = new Map(prev);
      if (delaPagina.length > 0 && delaPagina.every((m) => sig.has(m.id))) {
        delaPagina.forEach((m) => sig.delete(m.id));
      } else {
        delaPagina.forEach((m) => sig.set(m.id, m.email));
      }
      return sig;
    });
  }, [delaPagina]);

  /** Manda `ids` en tandas de 10, una tras otra. `base` son las filas que ya
   *  había (al reintentar), para que las reintentadas se actualicen en su
   *  sitio y el resto se conserve. */
  const correr = useCallback(async (accion, ids, base, correos) => {
    if (ocupadoRef.current || ids.length === 0) return;
    ocupadoRef.current = true;
    setAvisoNada(false);
    // El botón (o el diálogo) que tenía el foco se apaga o desaparece: sin esto
    // el foco cae al <body> justo cuando arranca la operación larga.
    if (tituloGenteRef.current) tituloGenteRef.current.focus();
    setEnCurso(accion);
    setErrorRun(null);
    setConfirmando(false);
    const llamar = accion === "cubrir" ? cubrirCurso : dejarDeCubrirCurso;
    const curso = Number(cursoId);
    const tandas = trocear(ids, TAMANO_DE_TANDA);
    let acumuladas = base;
    const filaLocal = (id, resultado, detalle) => ({
      usr_id: id, email: correos.get(id) || "", resultado, detalle,
    });
    try {
      for (let i = 0; i < tandas.length; i += 1) {
        const tanda = tandas[i];
        setProgreso({ i: i + 1, n: tandas.length });
        let respuesta;
        try {
          respuesta = await llamar(curso, tanda);
        } catch (err) {
          const kind = kindDe(err);
          // La tanda que cayó y todas las que faltaban. Si el servidor dijo que
          // no escribió nada, "sin enviar"; si no se sabe, "por confirmar".
          const detalleTanda = SIN_ESCRIBIR.has(kind) ? DET_NO_SE_ENVIO : DET_SIN_RESPUESTA;
          const restantes = tandas.slice(i + 1).flat();
          acumuladas = fusionar(acumuladas, [
            ...tanda.map((id) => filaLocal(id, "enrol_failed", detalleTanda)),
            ...restantes.map((id) => filaLocal(id, "enrol_failed", DET_NO_SE_ENVIO)),
          ]);
          setErrorRun(kind);
          break;
        }
        const nuevas = [...respuesta.filas];
        // Una persona pedida puede no volver en `filas` (el servidor descarta a
        // quien ya no es de la empresa o dejó de ser rol 3 o 4 entre el GET de la
        // lista y este POST; la lista ya viene filtrada por rol, así que es una
        // carrera, no el caso normal). Sin esto desaparecería sin decir nada.
        for (const id of tanda) {
          if (!nuevas.some((f) => f.usr_id === id)) nuevas.push(filaLocal(id, "sin_fila", null));
        }
        acumuladas = fusionar(acumuladas, nuevas);
        setCobertura((prev) => {
          const sig = { ...prev };
          for (const f of nuevas) {
            const { tipo } = clasificarFila(accion, f);
            if (tipo === "incierto") {
              // El servidor pudo escribir: lo que se sabía de esta persona dejó
              // de ser verdad. Se vuelve a preguntar al volver a su página.
              sig[f.usr_id] = "unknown";
            } else if (accion === "cubrir") {
              if (tipo === "ok") sig[f.usr_id] = true;
            } else if (f.resultado === "uncovered" || f.resultado === "not_covered") {
              // SOLO lo que el servidor dijo. La fila `sin_fila` la fabrica esta
              // pantalla: de esa persona no se sabe nada y no cambia su estado.
              sig[f.usr_id] = false;
            }
          }
          return sig;
        });
      }
    } finally {
      setFilas(acumuladas);
      setAccionUlt(accion);
      setSeleccion(new Map());
      setProgreso(null);
      setEnCurso(null);
      ocupadoRef.current = false;
    }
  }, [cursoId]);

  /** Lo que de verdad viaja: la selección refiltrada con la MISMA regla de las
   *  casillas, en los tres caminos (cubrir, dejar de cubrir y reintentar). */
  const vigentes = useCallback((accion, ids) => ids.filter(
    (id) => puede(accion, vistosRef.current.get(id), cobertura, id)), [cobertura]);

  /** Sin nada que enviar se DICE, en vez de volver en silencio. `limpiar` borra
   *  la tabla vieja (cubrir y dejar de cubrir): si no, quedaría haciendo de
   *  respuesta a un clic que no mandó nada. Al reintentar se conserva, porque
   *  sigue siendo la respuesta de lo que sí se envió. */
  const avisarSinNada = useCallback((limpiar) => {
    if (limpiar) {
      setFilas([]);
      setAccionUlt(null);
    }
    setErrorRun(null);
    setConfirmando(false);
    setAvisoNada(true);
  }, []);

  const cubrir = useCallback(() => {
    const ids = vigentes("cubrir", [...seleccion.keys()]);
    if (ids.length === 0) { avisarSinNada(true); return; }
    correr("cubrir", ids, [], seleccion);
  }, [seleccion, vigentes, avisarSinNada, correr]);

  const pedirConfirmacion = useCallback(() => {
    if (seleccion.size === 0) return;
    setConfirmando(true);
  }, [seleccion]);

  const cancelarConfirmacion = useCallback(() => {
    setConfirmando(false);
    if (botonDejarRef.current) botonDejarRef.current.focus();
  }, []);

  const dejarDeCubrir = useCallback(() => {
    const ids = vigentes("dejar", [...seleccion.keys()]);
    if (ids.length === 0) { avisarSinNada(true); return; }
    correr("dejar", ids, [], seleccion);
  }, [seleccion, vigentes, avisarSinNada, correr]);

  const reintentar = useCallback(() => {
    if (!accionUlt) return;
    const correos = new Map(filas.map((f) => [f.usr_id, f.email]));
    const ids = vigentes(accionUlt, reintentables(accionUlt, filas));
    if (ids.length === 0) { avisarSinNada(false); return; }
    correr(accionUlt, ids, filas, correos);
  }, [accionUlt, filas, vigentes, avisarSinNada, correr]);

  // Escape cierra la confirmación en línea y devuelve el foco a quien la abrió.
  useEffect(() => {
    if (!confirmando) return undefined;
    function alTeclear(ev) {
      if (ev.key === "Escape") cancelarConfirmacion();
    }
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, [confirmando, cancelarConfirmacion]);

  // Al abrir la confirmación el foco pasa a ella: quien usa teclado o lector de
  // pantalla no se queda en un botón que ya no es lo importante.
  useEffect(() => {
    if (confirmando && dialogoRef.current) dialogoRef.current.focus();
  }, [confirmando]);

  if (!ready) return null;

  // ── Catálogo ──────────────────────────────────────────────────────────
  if (catalogo.estado === "cargando") {
    return <p className={styles.muted} role="status">{t("loadingCatalog")}</p>;
  }
  if (catalogo.estado === "error") {
    // NO se pinta una lista vacía: no se pudo leer, y eso es lo que se dice.
    return (
      <div className={styles.wrapper}>
        <p className={styles.error} role="alert">{t(`loadError.${catalogo.kind}`)}</p>
        <button type="button" className="btn-ghost" onClick={cargarCatalogo}>
          {t("retryLoad")}
        </button>
      </div>
    );
  }

  const secciones = catalogo.datos.secciones
    .filter((s) => s && Array.isArray(s.cursos) && s.cursos.length > 0);
  const avisos = catalogo.datos.avisos;

  if (secciones.length === 0) {
    return (
      <div className={styles.wrapper}>
        <p className={styles.muted}>{t("noCourses")}</p>
        {avisos > 0 && <p className={styles.notice} role="status">{t("avisos")}</p>}
      </div>
    );
  }

  const ocupado = Boolean(enCurso);
  // Con la confirmación abierta, lo de abajo no se mueve (no es un modal: el
  // foco no se atrapa, pero tampoco se puede cambiar la selección o la página
  // que la confirmación está describiendo).
  const congelado = ocupado || confirmando;
  const n = seleccion.size;
  const total = gente.estado === "ok" ? gente.total : 0;
  const hayMas = offset + TAMANO_DE_TANDA < total;
  const pendientes = accionUlt ? reintentables(accionUlt, filas) : [];

  const conteo = Object.fromEntries(TIPOS.map((x) => [x, 0]));
  const clasif = filas.map((f) => ({ f, c: clasificarFila(accionUlt, f) }));
  clasif.forEach(({ c }) => { conteo[c.tipo] += 1; });
  const hayPendientes = clasif.some(({ c }) => c.tipo === "pendiente" || c.tipo === "noatendida");
  const hayInciertas = clasif.some(({ c }) => c.tipo === "incierto");

  return (
    <div className={styles.wrapper}>
      <p className={styles.intro}>{t("intro")}</p>
      <p className={styles.backRow}>
        <a className={styles.link} href={RUTA_PANEL}>{t("backToTeam")}</a>
      </p>

      {avisos > 0 && <p className={styles.notice} role="status">{t("avisos")}</p>}

      <section className={styles.card}>
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="training-course">{t("courseLabel")}</label>
          <select
            id="training-course"
            className={styles.select}
            value={cursoId}
            onChange={elegirCurso}
            disabled={congelado}
          >
            <option value="">{t("coursePlaceholder")}</option>
            {secciones.map((s, i) => (
              // El catálogo no trae un id de sección: dos con el mismo nombre
              // chocarían como clave, así que va con su posición.
              <optgroup key={`${i}-${s.nombre}`} label={s.nombre}>
                {s.cursos.map((c) => (
                  <option key={c.moodle_course_id} value={String(c.moodle_course_id)}>{c.nombre}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <fieldset className={styles.modos} disabled={congelado}>
          <legend className={styles.fieldLabel}>{t("modeLabel")}</legend>
          <label className={styles.modo}>
            <input
              type="radio"
              name="training-mode"
              checked={modo === "cubrir"}
              onChange={() => elegirModo("cubrir")}
            />
            <span>{t("modeCover")}</span>
          </label>
          <label className={styles.modo}>
            <input
              type="radio"
              name="training-mode"
              checked={modo === "dejar"}
              onChange={() => elegirModo("dejar")}
            />
            <span>{t("modeStop")}</span>
          </label>
        </fieldset>
      </section>

      <section className={styles.card} aria-busy={gente.estado === "cargando"}>
        <h2 ref={tituloGenteRef} tabIndex={-1} className={styles.cardTitle}>{t("peopleTitle")}</h2>

        {!cursoId && <p className={styles.muted}>{t("chooseCourseFirst")}</p>}
        {cursoId && gente.estado === "cargando" && (
          <p className={styles.muted} role="status">{t("peopleLoading")}</p>
        )}
        {cursoId && gente.estado === "error" && (
          <p className={styles.error} role="alert">{t(claveErrorGente(gente.err))}</p>
        )}
        {cursoId && gente.estado === "ok" && members.length === 0 && (
          // Con invitaciones pendientes el panel de al lado SÍ muestra filas:
          // "no hay nadie" sería falso a medias.
          <p className={styles.muted}>
            {gente.invitaciones > 0 ? t("peopleOnlyInvited") : t("peopleEmpty")}
          </p>
        )}

        {cursoId && gente.estado === "ok" && members.length > 0 && (
          <>
            {cobEstado === "error" && (
              <div className={styles.notice} role="status">
                {t("coverageUnavailable")}{" "}
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setIntentoCob((n) => n + 1)}
                  disabled={ocupado}
                >
                  {t("coverageRetry")}
                </button>
              </div>
            )}
            <label className={styles.todos}>
              <input
                type="checkbox"
                checked={todosMarcados}
                onChange={alternarPagina}
                disabled={congelado || delaPagina.length === 0}
              />
              <span>{t("selectAllPage")}</span>
            </label>
            <ul className={styles.gente} aria-label={t("peopleTitle")}>
              {members.map((m) => {
                // Último recurso: nunca una casilla con el nombre accesible "Select ".
                const nombre = displayNameFor(m) || m.name || t("unnamed");
                const desactivada = estaDesactivada(m);
                let estado = "unknown";
                if (cobertura[m.id] === true) estado = "covered";
                else if (cobertura[m.id] === false) estado = "notCovered";
                else if (cobertura[m.id] === "unknown") estado = "couldNotCheck";
                else if (cobEstado === "cargando") estado = "checking";
                return (
                  <li key={m.id} className={styles.persona}>
                    <input
                      type="checkbox"
                      checked={seleccion.has(m.id)}
                      onChange={() => alternar(m)}
                      disabled={!marcable(m)}
                      aria-label={t("selectPerson", { name: nombre })}
                    />
                    <span className={styles.nombre}>{nombre}</span>
                    <span className={styles.correo}>{m.email}</span>
                    {/* Los DOS estados, uno junto al otro: que esté desactivada
                        no tapa si está cubierta. */}
                    <span className={styles.estado}>
                      {desactivada && <span>{tPanel("status.deactivated")}</span>}
                      <span>{t(`coverage.${estado}`)}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
            {total > TAMANO_DE_TANDA && (
              <nav className={styles.pager}>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={congelado || offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - TAMANO_DE_TANDA))}
                >
                  {t("page.prev")}
                </button>
                <span className={styles.total}>
                  {t("page.range", { from: offset + 1, to: offset + members.length, total })}
                </span>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={congelado || !hayMas}
                  onClick={() => setOffset(offset + TAMANO_DE_TANDA)}
                >
                  {t("page.next")}
                </button>
              </nav>
            )}
          </>
        )}

        {cursoId && gente.estado === "ok" && members.length > 0 && (
          <div className={styles.actions}>
            <span className={styles.total}>{t("selected", { n })}</span>
            {/* DORADO: `.btn-primary` es el ÚNICO elemento dorado de la vista y
                solo existe en modo cubrir; dejar de cubrir es fantasma. */}
            {modo === "cubrir" ? (
              <button
                type="button"
                className="btn-primary"
                onClick={cubrir}
                disabled={ocupado || n === 0}
              >
                {n > 0 ? t("cover", { n }) : t("coverNothing")}
              </button>
            ) : (
              <button
                ref={botonDejarRef}
                type="button"
                className="btn-ghost"
                onClick={pedirConfirmacion}
                disabled={ocupado || n === 0}
              >
                {n > 0 ? t("stop", { n }) : t("stopNothing")}
              </button>
            )}
          </div>
        )}

        {avisoNada && <p className={styles.notice} role="status">{t("nothingToSend")}</p>}

        {progreso && (
          <p className={styles.progreso} role="status" aria-live="polite">
            {t("progress", { i: progreso.i, n: progreso.n })}
          </p>
        )}

        {/* Confirmación EN LÍNEA (nada de confirm() ni de modal del navegador).
            Solo al dejar de cubrir: cubrir es frecuente y reversible. */}
        {confirmando && (
          <div
            ref={dialogoRef}
            className={styles.confirm}
            role="alertdialog"
            aria-labelledby="training-confirm-title"
            tabIndex={-1}
          >
            <h3 id="training-confirm-title" className={styles.blockTitle}>{t("confirm.title", { n })}</h3>
            <ul className={styles.hechos}>
              <li>{t("confirm.loses")}</li>
              <li>{t("confirm.keeps")}</li>
              <li>{t("confirm.reversible")}</li>
            </ul>
            <div className={styles.actions}>
              <button type="button" className="btn-ghost" onClick={dejarDeCubrir}>
                {t("confirm.yes")}
              </button>
              <button type="button" className="btn-ghost" onClick={cancelarConfirmacion}>
                {t("confirm.no")}
              </button>
            </div>
          </div>
        )}
      </section>

      {errorRun && <p className={styles.error} role="alert">{t(`runError.${errorRun}`)}</p>}

      {filas.length > 0 && (
        <section className={styles.card} aria-labelledby="training-results-title">
          <h2 id="training-results-title" className={styles.cardTitle}>{t("results.title")}</h2>
          {/* De QUÉ acción habla este panel: el radio de arriba puede haber
              cambiado, y reintentar repite la acción de ESTE resultado. */}
          <p id="training-results-about" className={styles.total}>
            {t(`results.about.${accionUlt === "cubrir" ? "cubrir" : "dejar"}`)}
          </p>
          <p className={styles.total}>{t("results.summary", conteo)}</p>
          {hayPendientes && <p className={styles.muted}>{t("results.pendingNote")}</p>}
          {hayInciertas && <p className={styles.muted}>{t("results.uncertainNote")}</p>}

          <div className={styles.tablaWrap}>
            <table className={styles.tabla}>
              <thead>
                <tr>
                  <th scope="col">{t("results.person")}</th>
                  <th scope="col">{t("results.outcome")}</th>
                </tr>
              </thead>
              <tbody>
                {clasif.map(({ f, c }) => (
                  <tr key={f.usr_id} className={styles[`tipo_${c.tipo}`]}>
                    <td className={styles.correo}>{f.email}</td>
                    <td>
                      {/* La etiqueta va en TEXTO: el color solo no distingue. */}
                      <span className={styles.etiqueta}>{t(`results.tipo.${c.tipo}`)}</span>
                      <span className={styles.frase}>{t(c.resultadoKey)}</span>
                      {c.detalleKey && <span className={styles.frase}>{t(c.detalleKey)}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pendientes.length > 0 && (
            <div className={styles.actions}>
              <button
                type="button"
                className="btn-ghost"
                onClick={reintentar}
                disabled={ocupado}
                aria-describedby="training-results-about"
              >
                {t("results.retry", { n: pendientes.length })}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
