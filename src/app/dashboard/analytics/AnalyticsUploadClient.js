"use client";

/**
 * AnalyticsUploadClient — pantalla "Cargar ventas" (analytics del Dashboard
 * Analítico). Mismo patrón que EvalClient.js: guard de auth con
 * useEffect/router.replace, useT() por namespace, useState, try/catch con
 * err.message del backend como mensaje preferente.
 *
 * Flujo: seleccionar propiedad (o crear una nueva inline) -> elegir archivo
 * (.zip o Sales by day.csv) -> Vista previa (dry-run, previewUpload) ->
 * Confirmar (commitUpload). Nunca se renderiza la palabra "Moodle".
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getProperties,
  createProperty,
  previewUpload,
  commitUpload,
} from "../../../lib/api";
import { isAuthenticated } from "../../../lib/session";
import { deriveCompanies, activeProperties, isAcceptedFile } from "../../../lib/analytics";
import { useT } from "../../../i18n/client";
import styles from "./page.module.css";

export default function AnalyticsUploadClient() {
  const t = useT("analytics");
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [properties, setProperties] = useState(null);
  const [propsError, setPropsError] = useState(null);
  const [selectedId, setSelectedId] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCurrency, setNewCurrency] = useState("USD");
  const [newCompId, setNewCompId] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState(null);
  const [committed, setCommitted] = useState(null);

  // Página privada: sin sesión, a login con ?next= (mismo patrón que
  // EvalClient.js / AccountClient.js).
  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login?next=/dashboard/analytics");
      return;
    }
    setReady(true);
  }, [router]);

  // Propiedades al montar.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    getProperties()
      .then((list) => {
        if (!cancelled) setProperties(list);
      })
      .catch((err) => {
        if (!cancelled) {
          setPropsError(err.message || t("unavailable"));
          setProperties([]);
        }
      });
    return () => {
      cancelled = true;
    };
    // `t` de useT() es una nueva función en cada render (no memoizada); ver
    // nota equivalente en EvalClient.js.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  if (!ready) return null;

  const companies = deriveCompanies(properties || []);
  const showCompanySelect = companies.length > 1;
  const activeList = activeProperties(properties || []);

  function handleFile(e) {
    const f = e.target.files?.[0] || null;
    setSummary(null);
    setCommitted(null);
    setPreviewError(null);
    setConfirmError(null);
    if (f && !isAcceptedFile(f.name)) {
      setFile(null);
      setFileError(t("fileTypeError"));
      return;
    }
    setFileError(null);
    setFile(f);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      const payload = { name: newName, currency: newCurrency };
      if (showCompanySelect) payload.comp_id = Number(newCompId);
      const data = await createProperty(payload);
      const created = data.property;
      const list = await getProperties();
      setProperties(list);
      setSelectedId(String(created.id));
      setShowNew(false);
      setNewName("");
      setNewCurrency("USD");
      setNewCompId("");
    } catch (err) {
      setCreateError(err.message || t("unavailable"));
    } finally {
      setCreating(false);
    }
  }

  async function handlePreview() {
    setPreviewError(null);
    setSummary(null);
    setCommitted(null);
    setPreviewing(true);
    try {
      const data = await previewUpload(selectedId, file);
      setSummary(data.summary);
    } catch (err) {
      setPreviewError(err.message || t("unavailable"));
    } finally {
      setPreviewing(false);
    }
  }

  async function handleConfirm() {
    setConfirmError(null);
    setConfirming(true);
    try {
      const data = await commitUpload(selectedId, file);
      setCommitted(data.summary);
    } catch (err) {
      setConfirmError(err.message || t("unavailable"));
    } finally {
      setConfirming(false);
    }
  }

  const canPreview = selectedId && file && !fileError;

  return (
    <section className={styles.card}>
      {/* Selector de propiedad */}
      <label className={styles.field}>
        <span className={styles.fieldLabel}>{t("selectProperty")}</span>
        {properties === null ? (
          <p className={styles.muted}>{t("loading")}</p>
        ) : propsError ? (
          <div className={styles.error} role="alert">
            {propsError}
          </div>
        ) : (
          <select
            className={styles.select}
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            <option value="">{t("selectProperty")}</option>
            {activeList.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </label>

      <button
        type="button"
        className={styles.ghostButton}
        onClick={() => setShowNew((v) => !v)}
      >
        {t("addNew")}
      </button>

      {showNew && (
        <form className={styles.newForm} onSubmit={handleCreate}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>{t("name")}</span>
            <input
              className={styles.input}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
            />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>{t("currency")}</span>
            <select
              className={styles.select}
              value={newCurrency}
              onChange={(e) => setNewCurrency(e.target.value)}
            >
              <option value="USD">USD</option>
              <option value="COP">COP</option>
            </select>
          </label>
          {showCompanySelect && (
            <label className={styles.field}>
              <span className={styles.fieldLabel}>{t("company")}</span>
              <select
                className={styles.select}
                value={newCompId}
                onChange={(e) => setNewCompId(e.target.value)}
                required
              >
                <option value="">{t("company")}</option>
                {companies.map((c) => (
                  <option key={c.comp_id} value={c.comp_id}>
                    {c.company_name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {createError && (
            <div className={styles.error} role="alert">
              {createError}
            </div>
          )}
          <div className={styles.actionsRow}>
            <button
              type="button"
              className={styles.ghostButton}
              onClick={() => setShowNew(false)}
            >
              {t("cancel")}
            </button>
            <button type="submit" className="btn-primary" disabled={creating}>
              {creating ? t("loading") : t("save")}
            </button>
          </div>
        </form>
      )}

      {/* Archivo */}
      <label className={styles.field}>
        <span className={styles.fieldLabel}>{t("chooseFile")}</span>
        <input type="file" accept=".zip,.csv" onChange={handleFile} />
        <span className={styles.muted}>{t("fileHint")}</span>
      </label>
      {fileError && (
        <div className={styles.error} role="alert">
          {fileError}
        </div>
      )}

      {/* Vista previa */}
      <button
        type="button"
        className={styles.ghostButton}
        onClick={handlePreview}
        disabled={!canPreview || previewing}
      >
        {previewing ? t("previewLoading") : t("preview")}
      </button>
      {previewError && (
        <div className={styles.error} role="alert">
          {previewError}
        </div>
      )}

      {summary && !committed && (
        <div className={styles.summary}>
          <p>
            {t("summaryProperty")}: {summary.property_name}
          </p>
          <p>
            {t("summaryRows")}: {summary.row_count}
          </p>
          <p>
            {t("summaryPeriod")}: {summary.period_start} – {summary.period_end}
          </p>
          <p>
            {t("summaryNet")}: {summary.net_sales_total}
          </p>
          {confirmError && (
            <div className={styles.error} role="alert">
              {confirmError}
            </div>
          )}
          <button
            type="button"
            className="btn-primary"
            onClick={handleConfirm}
            disabled={confirming}
          >
            {confirming ? t("confirmLoading") : t("confirm")}
          </button>
        </div>
      )}

      {committed && (
        <div className={styles.success} role="status">
          {t("uploadSuccess")} ({committed.row_count})
        </div>
      )}

      <div className={styles.selectFooter}>
        <a className={styles.link} href="/dashboard/analytics/properties">
          {t("managePropertiesLink")}
        </a>
      </div>
    </section>
  );
}
