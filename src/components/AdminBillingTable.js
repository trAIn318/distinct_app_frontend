"use client";

/**
 * AdminBillingTable — la consola de Distinct: qué empresas pagaron, con qué
 * plan y qué falta en cada una.
 *
 * `que_falta` lo calcula el backend (`billing_admin_views._que_falta`): es una
 * regla de negocio y repartida en dos códigos se desincroniza. Aquí solo se
 * traduce a texto. La consola no cobra nada: no hay botón de pagar.
 *
 * Asignar el plan responde con la fila ya recalculada; se reemplaza esa fila
 * en lugar de volver a pedir toda la lista.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { asignarPlan, crearEmpresa, getEmpresasDePago } from "../lib/api";
import { useT } from "../i18n/client";
import styles from "./AdminBillingTable.module.css";

const FALTA_CONOCIDO = ["sin_plan", "solo_contacto", "impago", "sin_pagar", "cupos_sin_facturar", "al_dia"];

export default function AdminBillingTable() {
  const t = useT("pay");

  const [fase, setFase] = useState("cargando");   // cargando | listo | fallo
  const [filas, setFilas] = useState([]);
  // Los planes asignables salen del catálogo del backend: una lista copiada aquí
  // se desincroniza el día que cambie y ofrecería un plan que no se puede cobrar.
  const [planes, setPlanes] = useState([]);

  const cargar = useCallback(async () => {
    setFase("cargando");
    try {
      const datos = await getEmpresasDePago();
      setFilas(Array.isArray(datos && datos.empresas) ? datos.empresas : []);
      setPlanes(Array.isArray(datos && datos.planes_asignables) ? datos.planes_asignables : []);
      setFase("listo");
    } catch {
      setFase("fallo");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial
    cargar();
  }, [cargar]);

  const reemplazar = (fila) =>
    setFilas((actual) => actual.map((f) => (f.comp_id === fila.comp_id ? fila : f)));

  if (fase === "cargando") {
    return (
      <section className={styles.card} aria-busy="true">
        <p className={styles.muted}>{t("admin.loading")}</p>
      </section>
    );
  }

  if (fase === "fallo") {
    return (
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>{t("loadFailedTitle")}</h2>
        <p className={styles.error} role="alert">{t("loadFailedBody")}</p>
        <button type="button" className="btn-ghost" onClick={cargar}>{t("retry")}</button>
      </section>
    );
  }

  return (
    <>
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>{t("admin.title")}</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t("admin.colCompany")}</th>
                <th scope="col">{t("admin.colPlan")}</th>
                <th scope="col">{t("admin.colMembers")}</th>
                <th scope="col">{t("admin.colAdmin")}</th>
                <th scope="col">{t("admin.colMissing")}</th>
                <th scope="col">{t("admin.colAction")}</th>
              </tr>
            </thead>
            <tbody>
              {filas.length === 0 && (
                <tr><td colSpan={6}>{t("admin.empty")}</td></tr>
              )}
              {filas.map((fila) => (
                <FilaEmpresa key={fila.comp_id} fila={fila} planes={planes} onChange={reemplazar} t={t} />
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <FormularioEmpresa onCreada={(fila) => setFilas((actual) => [...actual, fila])} t={t} />
    </>
  );
}

/** Nombre legible de un plan; si no hay traducción, el código del backend. */
function nombreDePlan(t, codigo) {
  const texto = t(`plans.${codigo}`);
  return texto === `pay.plans.${codigo}` ? codigo : texto;
}

function FilaEmpresa({ fila, planes, onChange, t }) {
  const ocupadoRef = useRef(false);
  const [elegido, setElegido] = useState(fila.plan_code || "");
  const [enCurso, setEnCurso] = useState(false);
  const [error, setError] = useState(false);

  async function asignar() {
    if (ocupadoRef.current || !elegido) return;
    ocupadoRef.current = true;
    setEnCurso(true);
    setError(false);
    try {
      onChange(await asignarPlan(fila.comp_id, { comp_plan_code: elegido }));
    } catch {
      setError(true);
    }
    ocupadoRef.current = false;
    setEnCurso(false);
  }

  const falta = FALTA_CONOCIDO.includes(fila.que_falta) ? t(`admin.missing.${fila.que_falta}`) : fila.que_falta;
  const plan = fila.plan_code ? nombreDePlan(t, fila.plan_code) : "—";

  return (
    <tr>
      <td>{fila.comp_name}</td>
      <td>{plan}</td>
      <td>
        {fila.cupos_incluidos === null || fila.cupos_incluidos === undefined
          ? fila.miembros
          : t("admin.membersOfSeats", { members: fila.miembros, seats: fila.cupos_incluidos })}
      </td>
      <td>{fila.admin_email || t("admin.noAdmin")}</td>
      <td>
        <span>{falta}</span>
        {fila.que_falta === "cupos_sin_facturar" && (
          <span className={styles.personEmail}>
            {t("admin.seatsNotBilled", { needed: fila.cupos_extra_necesarios, billed: fila.cupos_extra_facturados })}
          </span>
        )}
      </td>
      <td>
        <select
          className={styles.input}
          aria-label={t("admin.planFor", { company: fila.comp_name })}
          value={elegido}
          onChange={(e) => setElegido(e.target.value)}
          disabled={enCurso}
        >
          <option value="">{t("admin.choosePlan")}</option>
          {planes.map((p) => <option key={p} value={p}>{nombreDePlan(t, p)}</option>)}
        </select>
        <button type="button" className="btn-ghost" onClick={asignar} disabled={enCurso || !elegido}>
          {enCurso ? t("admin.assigning") : t("admin.assign")}
        </button>
        {/* Con suscripción viva el Plan mostrado sigue al espejo: asignar otro
            plan no lo cambia hasta la próxima suscripción. Sin esta nota el
            operador ve el selector cambiado y la columna igual, y re-pulsa. */}
        {fila.estado_suscripcion && <p className={styles.personEmail}>{t("admin.planNote")}</p>}
        {error && <p className={styles.fieldError} role="alert">{t("errGeneric")}</p>}
      </td>
    </tr>
  );
}

function FormularioEmpresa({ onCreada, t }) {
  const ocupadoRef = useRef(false);
  const [valores, setValores] = useState({ name: "", city: "", country: "", phone: "", moodle: "" });
  const [errores, setErrores] = useState({});
  const [enCurso, setEnCurso] = useState(false);
  const [fallo, setFallo] = useState(false);

  const cambia = (campo) => (e) => setValores((v) => ({ ...v, [campo]: e.target.value }));

  async function enviar(e) {
    e.preventDefault();
    if (ocupadoRef.current) return;
    const nuevos = {};
    if (!valores.name.trim()) nuevos.name = t("admin.nameRequired");
    // El backend exige el id de una categoría de Moodle que exista: sin ella la
    // empresa nace sin catálogo de cursos y el error aparece semanas después.
    if (!/^\d+$/.test(valores.moodle.trim()) || Number(valores.moodle) <= 0) {
      nuevos.moodle = t("admin.moodleCategoryRequired");
    }
    setErrores(nuevos);
    if (Object.keys(nuevos).length) return;

    ocupadoRef.current = true;
    setEnCurso(true);
    setFallo(false);
    const datos = { comp_name: valores.name.trim(), moodle_categories_id: Number(valores.moodle) };
    if (valores.city.trim()) datos.comp_city = valores.city.trim();
    if (valores.country.trim()) datos.comp_country = valores.country.trim();
    if (valores.phone.trim()) datos.comp_phone = valores.phone.trim();
    try {
      onCreada(await crearEmpresa(datos));
      setValores({ name: "", city: "", country: "", phone: "", moodle: "" });
    } catch {
      setFallo(true);
    }
    ocupadoRef.current = false;
    setEnCurso(false);
  }

  return (
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>{t("admin.createTitle")}</h2>
      <form onSubmit={enviar} noValidate>
        <Campo id="pay-name" label={t("admin.name")} value={valores.name} onChange={cambia("name")}
          error={errores.name} required t={t} />
        <Campo id="pay-city" label={t("admin.city")} value={valores.city} onChange={cambia("city")} t={t} />
        <Campo id="pay-country" label={t("admin.country")} value={valores.country} onChange={cambia("country")} t={t} />
        <Campo id="pay-phone" label={t("admin.phone")} value={valores.phone} onChange={cambia("phone")} t={t} />
        <Campo id="pay-moodle" label={t("admin.moodleCategory")} value={valores.moodle} onChange={cambia("moodle")}
          error={errores.moodle} required inputMode="numeric" t={t} />
        {fallo && <p className={styles.error} role="alert">{t("admin.createFailed")}</p>}
        <button type="submit" className="btn-primary" disabled={enCurso}>
          {enCurso ? t("admin.creating") : t("admin.create")}
        </button>
      </form>
    </section>
  );
}

function Campo({ id, label, value, onChange, error, required = false, inputMode, t }) {
  const errorId = `${id}-error`;
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.fieldLabel}>
        {label}
        {required && (
          <>
            <span className={styles.requerido} aria-hidden="true"> *</span>
            <span className="sr-only"> ({t("admin.required")})</span>
          </>
        )}
      </label>
      <input
        id={id}
        className={styles.input}
        type="text"
        inputMode={inputMode}
        value={value}
        onChange={onChange}
        required={required}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
      {error && <p id={errorId} className={styles.fieldError}>{error}</p>}
    </div>
  );
}
