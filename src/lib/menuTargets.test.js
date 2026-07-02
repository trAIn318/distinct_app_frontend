import { describe, it, expect } from "vitest";
import {
  splitMenuByGroup,
  resolveMenuTarget,
  parseIconName,
  menuLabelKey,
  getMenuLabel,
} from "./menuTargets";

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
  it("mapea rutas con acción/pantalla propia", () => {
    expect(resolveMenuTarget("dashboard/trainy")).toEqual({ type: "train" });
    expect(resolveMenuTarget("/dashboard/trainy")).toEqual({ type: "train" });
    expect(resolveMenuTarget("settings/language")).toEqual({ type: "language" });
  });

  it("dashboard/dash y el resto caen a /coming-soon (aún sin pantalla)", () => {
    expect(resolveMenuTarget("dashboard/dash")).toEqual({ type: "route", href: "/coming-soon" });
    expect(resolveMenuTarget("dashboard/eval")).toEqual({ type: "route", href: "/coming-soon" });
    expect(resolveMenuTarget("recruiter/load_cvs")).toEqual({ type: "route", href: "/coming-soon" });
    expect(resolveMenuTarget("")).toEqual({ type: "route", href: "/coming-soon" });
    expect(resolveMenuTarget(undefined)).toEqual({ type: "route", href: "/coming-soon" });
  });
});

describe("getMenuLabel", () => {
  const tMenu = (k) => ({ loadCvs: "Cargar CVs", eval: "Evaluación" }[k] || `menu.${k}`);

  it("traduce las opciones mapeadas vía tMenu", () => {
    expect(getMenuLabel({ url: "recruiter/load_cvs", title: "Load CVs" }, tMenu)).toBe("Cargar CVs");
    expect(getMenuLabel({ url: "/dashboard/eval", title: "Eval" }, tMenu)).toBe("Evaluación");
  });

  it("cae al título de la BD para opciones no mapeadas", () => {
    expect(getMenuLabel({ url: "dashboard/dash", title: "Dash" }, tMenu)).toBe("Dash");
    expect(getMenuLabel({ url: "future/thing", title: "Nuevo" }, tMenu)).toBe("Nuevo");
  });

  it("menuLabelKey devuelve null para lo no mapeado", () => {
    expect(menuLabelKey("recruiter/load_cvs")).toBe("loadCvs");
    expect(menuLabelKey("dashboard/dash")).toBe(null);
  });
});

describe("parseIconName", () => {
  it("extrae el nombre del formato de la BD ':material/x:'", () => {
    expect(parseIconName(":material/bar_chart:")).toBe("bar_chart");
    expect(parseIconName("material/shopping_cart")).toBe("shopping_cart");
  });

  it("acepta el nombre pelado y normaliza a minúsculas", () => {
    expect(parseIconName("Person")).toBe("person");
    expect(parseIconName("quiz")).toBe("quiz");
  });

  it("devuelve '' con entrada vacía o nula", () => {
    expect(parseIconName("")).toBe("");
    expect(parseIconName(undefined)).toBe("");
    expect(parseIconName(null)).toBe("");
  });
});
