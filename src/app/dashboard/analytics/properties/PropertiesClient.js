"use client";

/**
 * PropertiesClient — pantalla "Mis propiedades" (Dashboard Analítico).
 * Mismo patrón que AnalyticsUploadClient.js: guard de auth con
 * useEffect/router.replace, useT() por namespace, useState, try/catch con
 * err.message del backend como mensaje preferente.
 *
 * Lista TODAS las propiedades (activas e inactivas) del alcance del usuario.
 * Permite: renombrar inline, activar/desactivar, y agregar una nueva
 * propiedad (mismo mini-form que en Cargar ventas). Cada mutación recarga
 * `getProperties()`. Nunca se renderiza la palabra "Moodle".
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getProperties, createProperty, updateProperty } from "../../../../lib/api";
import { isAuthenticated } from "../../../../lib/session";
import { deriveCompanies } from "../../../../lib/analytics";
import { useT } from "../../../../i18n/client";
import styles from "./page.module.css";

export default function PropertiesClient() {
  const t = useT("analytics");
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [properties, setProperties] = useState(null);
  const [listError, setListError] = useState(null);

  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState(null);

  const [togglingId, setTogglingId] = useState(null);
  const [toggleErrorId, setToggleErrorId] = useState(null);
  const [toggleError, setToggleError] = useState(null);

  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCurrency, setNewCurrency] = useState("USD");
  const [newCompId, setNewCompId] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  // Página privada: sin sesión, a login con ?next= (mismo patrón que
  // AnalyticsUploadClient.js / EvalClient.js / AccountClient.js).
  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login?next=/dashboard/analytics/properties");
      return;
    }
    setReady(true);
  }, [router]);

  async function loadProperties() {
    try {
      const list = await getProperties();
      setProperties(list);
      setListError(null);
      return list;
    } catch (err) {
      setListError(err.message || t("unavailable"));
      setProperties([]);
      return [];
    }
  }

  // Propiedades al montar. Guard `cancelled` para no hacer setState tras
  // desmontar si getProperties() sigue en vuelo (mismo patrón que
  // AnalyticsUploadClient.js). Las recargas post-mutación usan
  // loadProperties() directamente: son disparadas por una acción del
  // usuario mientras el componente sigue montado, no necesitan el guard.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    getProperties()
      .then((list) => {
        if (!cancelled) {
          setProperties(list);
          setListError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setListError(err.message || t("unavailable"));
          setProperties([]);
        }
      });
    return () => {
      cancelled = true;
    };
    // `t` de useT() es una nueva función en cada render (no memoizada); ver
    // nota equivalente en AnalyticsUploadClient.js.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  if (!ready) return null;

  const companies = deriveCompanies(properties || []);
  const showCompanyColumn = companies.length > 1;

  function startRename(p) {
    setEditingId(p.id);
    setEditName(p.name);
    setRenameError(null);
  }

  function cancelRename() {
    setEditingId(null);
    setEditName("");
    setRenameError(null);
  }

  async function handleRenameSave(id) {
    setRenameError(null);
    if (!editName.trim()) return;
    setRenaming(true);
    try {
      await updateProperty(id, { name: editName });
      await loadProperties();
      setEditingId(null);
      setEditName("");
    } catch (err) {
      setRenameError(err.message || t("unavailable"));
    } finally {
      setRenaming(false);
    }
  }

  async function handleToggleActive(p) {
    setToggleError(null);
    setToggleErrorId(null);
    setTogglingId(p.id);
    try {
      await updateProperty(p.id, { active: !p.active });
      await loadProperties();
    } catch (err) {
      setToggleError(err.message || t("unavailable"));
      setToggleErrorId(p.id);
    } finally {
      setTogglingId(null);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      const payload = { name: newName, currency: newCurrency };
      if (showCompanyColumn) payload.comp_id = Number(newCompId);
      await createProperty(payload);
      await loadProperties();
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

  return (
    <section className={styles.card}>
      {properties === null ? (
        <p className={styles.muted}>{t("loading")}</p>
      ) : listError ? (
        <div className={styles.error} role="alert">
          {listError}
        </div>
      ) : properties.length === 0 ? (
        <p className={styles.muted}>{t("empty")}</p>
      ) : (
        <ul className={styles.propList}>
          {properties.map((p) => (
            <li key={p.id} className={styles.propItem}>
              <div className={styles.propInfo}>
                {editingId === p.id ? (
                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>{t("name")}</span>
                    <input
                      className={styles.input}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  </label>
                ) : (
                  <span className={styles.propName}>{p.name}</span>
                )}
                <span className={styles.propMeta}>{p.currency}</span>
                {showCompanyColumn && (
                  <span className={styles.propMeta}>{p.company_name}</span>
                )}
                <span
                  className={p.active ? styles.badgeActive : styles.badgeInactive}
                >
                  {p.active ? t("active") : t("inactive")}
                </span>
              </div>

              {renameError && editingId === p.id && (
                <div className={styles.error} role="alert">
                  {renameError}
                </div>
              )}
              {toggleError && toggleErrorId === p.id && (
                <div className={styles.error} role="alert">
                  {toggleError}
                </div>
              )}

              <div className={styles.actionsRow}>
                {editingId === p.id ? (
                  <>
                    <button
                      type="button"
                      className={styles.ghostButton}
                      onClick={cancelRename}
                    >
                      {t("cancel")}
                    </button>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => handleRenameSave(p.id)}
                      disabled={renaming}
                    >
                      {renaming ? t("loading") : t("saveName")}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className={styles.ghostButton}
                    onClick={() => startRename(p)}
                  >
                    {t("rename")}
                  </button>
                )}
                <button
                  type="button"
                  className={styles.ghostButton}
                  onClick={() => handleToggleActive(p)}
                  disabled={togglingId === p.id}
                >
                  {p.active ? t("deactivate") : t("activate")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        className={styles.ghostButton}
        onClick={() => setShowNew((v) => !v)}
      >
        {t("addProperty")}
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
          {showCompanyColumn && (
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

      <div className={styles.selectFooter}>
        <a className={styles.link} href="/dashboard/analytics">
          {t("backToPanel")}
        </a>
        <a className={styles.link} href="/dashboard/analytics/upload">
          {t("uploadTitle")}
        </a>
      </div>
    </section>
  );
}
