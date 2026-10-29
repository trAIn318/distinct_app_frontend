/**
 * src/lib/analyticsPrefs.js
 * Preferencia (por navegador) de qué gráficas del panel se muestran.
 * localStorage, con acceso protegido para SSR y navegadores sin storage.
 */

const KEY = "dx_analytics_charts";

export const CHART_IDS = ["trend", "weekday", "traffic", "byProperty", "monthly"];

export function defaultChartPrefs() {
  return CHART_IDS.reduce((acc, id) => ({ ...acc, [id]: true }), {});
}

export function getChartPrefs() {
  if (typeof window === "undefined") return defaultChartPrefs();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return defaultChartPrefs();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return defaultChartPrefs();
    return { ...defaultChartPrefs(), ...parsed };
  } catch {
    return defaultChartPrefs();
  }
}

export function setChartPrefs(prefs) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* almacenamiento no disponible: preferencia no persiste, sin romper */
  }
}
