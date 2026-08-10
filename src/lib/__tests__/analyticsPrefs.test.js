import { describe, it, expect, beforeEach } from "vitest";
import { CHART_IDS, defaultChartPrefs, getChartPrefs, setChartPrefs } from "../analyticsPrefs";

beforeEach(() => { window.localStorage.clear(); });

describe("analyticsPrefs", () => {
  it("CHART_IDS lista los 5 tipos de gráfica", () => {
    expect(CHART_IDS).toEqual(["trend", "weekday", "traffic", "byProperty", "monthly"]);
  });
  it("defaultChartPrefs: todas visibles", () => {
    expect(defaultChartPrefs()).toEqual({
      trend: true, weekday: true, traffic: true, byProperty: true, monthly: true,
    });
  });
  it("getChartPrefs sin nada guardado → default", () => {
    expect(getChartPrefs()).toEqual(defaultChartPrefs());
  });
  it("setChartPrefs + getChartPrefs hace round-trip y mezcla con default", () => {
    setChartPrefs({ trend: false });
    const p = getChartPrefs();
    expect(p.trend).toBe(false);
    expect(p.weekday).toBe(true); // el resto queda en default
  });
  it("getChartPrefs tolera JSON corrupto → default", () => {
    window.localStorage.setItem("dx_analytics_charts", "no-json{");
    expect(getChartPrefs()).toEqual(defaultChartPrefs());
  });
});
