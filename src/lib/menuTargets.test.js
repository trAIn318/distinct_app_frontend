import { describe, it, expect } from "vitest";
import { splitMenuByGroup, resolveMenuTarget } from "./menuTargets";

describe("splitMenuByGroup", () => {
  it("reparte items por menu_group (case-insensitive)", () => {
    const items = [
      { group: "DASHBOARD", url: "dashboard/dash", title: "Dash" },
      { group: "recruiter", url: "recruiter/load_cvs", title: "Load CVs" },
      { group: "SETTINGS", url: "settings/language", title: "Language" },
    ];
    const out = splitMenuByGroup(items);
    expect(out.dashboard).toHaveLength(1);
    expect(out.recruiter).toHaveLength(1);
    expect(out.settings).toHaveLength(1);
    expect(out.dashboard[0].title).toBe("Dash");
  });

  it("ignora grupos desconocidos y entradas nulas sin romper", () => {
    const out = splitMenuByGroup([{ group: "WEIRD", url: "x" }, null, {}]);
    expect(out).toEqual({ dashboard: [], recruiter: [], settings: [] });
  });

  it("devuelve buckets vacíos con entrada vacía o undefined", () => {
    expect(splitMenuByGroup(undefined)).toEqual({ dashboard: [], recruiter: [], settings: [] });
    expect(splitMenuByGroup([])).toEqual({ dashboard: [], recruiter: [], settings: [] });
  });
});

describe("resolveMenuTarget", () => {
  it("mapea rutas conocidas", () => {
    expect(resolveMenuTarget("dashboard/trainy")).toEqual({ type: "train" });
    expect(resolveMenuTarget("/dashboard/trainy")).toEqual({ type: "train" });
    expect(resolveMenuTarget("dashboard/dash")).toEqual({ type: "dash" });
    expect(resolveMenuTarget("settings/language")).toEqual({ type: "language" });
  });

  it("todo lo demás cae a /coming-soon", () => {
    expect(resolveMenuTarget("recruiter/load_cvs")).toEqual({ type: "route", href: "/coming-soon" });
    expect(resolveMenuTarget("")).toEqual({ type: "route", href: "/coming-soon" });
    expect(resolveMenuTarget(undefined)).toEqual({ type: "route", href: "/coming-soon" });
  });
});
