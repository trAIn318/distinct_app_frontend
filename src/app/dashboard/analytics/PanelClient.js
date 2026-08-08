"use client";

/**
 * PanelClient — pantalla "Panel de ventas" (analytics del Dashboard
 * Analítico). Mismo patrón que AnalyticsUploadClient.js / EvalClient.js:
 * guard de auth con useEffect/router.replace, useT() por namespace,
 * useState, cancelled guard en el efecto de montaje, try/catch con
 * err.message del backend como mensaje preferente.
 *
 * Muestra, por moneda presente en el reporte: 4 KPIs con delta vs. periodo
 * anterior, dos gráficas (Recharts: tendencia y comparativa por propiedad,
 * Task 4) y una tabla de detalle diario con descarga CSV. Filtros de fecha +
 * propiedad recargan el reporte.
 */

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getSalesReport, getProperties } from "../../../lib/api";
import { isAuthenticated } from "../../../lib/session";
import { buildSalesCsv, formatDeltaPct } from "../../../lib/analytics";
import { useT } from "../../../i18n/client";
import SalesTrendChart from "../../../components/analytics/SalesTrendChart";
import SalesByPropertyChart from "../../../components/analytics/SalesByPropertyChart";
import styles from "./page.module.css";

export default function PanelClient() {
  const t = useT("analytics");
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [properties, setProperties] = useState([]);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [propertyId, setPropertyId] = useState("all");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Página privada: sin sesión, a login con ?next= (mismo patrón que
  // EvalClient.js / AnalyticsUploadClient.js).
  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login?next=/dashboard/analytics");
      return;
    }
    setReady(true);
  }, [router]);

  const load = useCallback(async (opts) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSalesReport(opts || {});
      setReport(data);
      if (data?.range?.start && !opts) {
        setStart(data.range.start);
        setEnd(data.range.end);
      }
    } catch (err) {
      setError(err.message || t("unavailable"));
    } finally {
      setLoading(false);
    }
    // `t` de useT() es una nueva función en cada render (no memoizada); ver
    // nota equivalente en EvalClient.js.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Propiedades (para el filtro) + reporte con rango por defecto al montar.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    getProperties()
      .then((list) => {
        if (!cancelled) setProperties(list);
      })
      .catch(() => {});
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  if (!ready) return null;

  function applyFilters() {
    load({ start: start || undefined, end: end || undefined, propertyId });
  }

  function downloadCsv(cur) {
    const csv = buildSalesCsv(cur.daily);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ventas_${cur.currency}_${report?.range?.start || ""}_${report?.range?.end || ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const currencies = report?.currencies || [];

  return (
    <section className={styles.panel}>
      {/* Filtros */}
      <div className={styles.filters}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t("from")}</span>
          <input
            className={styles.input}
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t("to")}</span>
          <input
            className={styles.input}
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t("filters")}</span>
          <select
            className={styles.select}
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
          >
            <option value="all">{t("allProperties")}</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn-primary" onClick={applyFilters}>
          {t("filters")}
        </button>
      </div>

      {error ? (
        <div className={styles.error} role="alert">
          {error}
        </div>
      ) : loading ? (
        <p className={styles.muted}>{t("loading")}</p>
      ) : currencies.length === 0 ? (
        <p className={styles.muted}>{t("emptyPeriod")}</p>
      ) : (
        currencies.map((cur) => (
          <div key={cur.currency} className={styles.currencyBlock}>
            {currencies.length > 1 && (
              <h2 className={styles.cardTitle}>{cur.currency}</h2>
            )}

            {/* KPIs */}
            <div className={styles.kpiRow}>
              {[
                ["kpiNetSales", cur.kpis.net_sales, cur.delta_pct.net_sales],
                ["kpiOrders", cur.kpis.order_count, cur.delta_pct.order_count],
                ["kpiGuests", cur.kpis.guest_count, cur.delta_pct.guest_count],
                ["kpiAvgTicket", cur.kpis.avg_ticket, cur.delta_pct.avg_ticket],
              ].map(([labelKey, value, delta]) => (
                <div key={labelKey} className={styles.kpiCard}>
                  <span className={styles.kpiLabel}>{t(labelKey)}</span>
                  <span className={styles.kpiValue}>{value}</span>
                  {formatDeltaPct(delta) && (
                    <span
                      className={
                        delta > 0
                          ? styles.deltaUp
                          : delta < 0
                          ? styles.deltaDown
                          : styles.deltaFlat
                      }
                    >
                      {formatDeltaPct(delta)}{" "}
                      <span className={styles.muted}>{t("vsPrevPeriod")}</span>
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Gráficas */}
            <h3 className={styles.cardTitle}>{t("trendTitle")}</h3>
            <div className={styles.chart} data-testid={`trend-${cur.currency}`}>
              <SalesTrendChart data={cur.daily} />
            </div>
            {cur.by_property.length > 1 && (
              <>
                <h3 className={styles.cardTitle}>{t("byPropertyTitle")}</h3>
                <div
                  className={styles.chart}
                  data-testid={`byprop-${cur.currency}`}
                >
                  <SalesByPropertyChart data={cur.by_property} />
                </div>
              </>
            )}

            {/* Tabla + CSV */}
            <div className={styles.tableHeader}>
              <h3 className={styles.cardTitle}>{t("detailTitle")}</h3>
              <button
                type="button"
                className={styles.ghostButton}
                onClick={() => downloadCsv(cur)}
              >
                {t("downloadCsv")}
              </button>
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{t("from")}</th>
                    <th>{t("kpiNetSales")}</th>
                    <th>{t("kpiOrders")}</th>
                    <th>{t("kpiGuests")}</th>
                  </tr>
                </thead>
                <tbody>
                  {cur.daily.map((d) => (
                    <tr key={d.date}>
                      <td>{d.date}</td>
                      <td>{d.net_sales}</td>
                      <td>{d.order_count}</td>
                      <td>{d.guest_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}

      <div className={styles.panelFooter}>
        <a className={styles.link} href="/dashboard/analytics/upload">
          {t("uploadTitle")}
        </a>
        <a className={styles.link} href="/dashboard/analytics/properties">
          {t("managePropertiesLink")}
        </a>
      </div>
    </section>
  );
}
