import { describe, it, expect } from "vitest";
import { getEnabledHomeSections, DEFAULT_HOME_SECTIONS } from "./homeSections";

describe("getEnabledHomeSections", () => {
  it("devuelve todas las secciones cuando la env var está vacía/indefinida", () => {
    expect(getEnabledHomeSections(undefined)).toEqual(DEFAULT_HOME_SECTIONS);
    expect(getEnabledHomeSections("")).toEqual(DEFAULT_HOME_SECTIONS);
    expect(getEnabledHomeSections("   ")).toEqual(DEFAULT_HOME_SECTIONS);
  });

  it("filtra a solo las keys presentes en el CSV", () => {
    expect(getEnabledHomeSections("hero,contact")).toEqual(["hero", "contact"]);
  });

  it("respeta el orden canónico, no el del CSV", () => {
    expect(getEnabledHomeSections("contact,hero")).toEqual(["hero", "contact"]);
  });

  it("ignora keys desconocidas y espacios", () => {
    expect(getEnabledHomeSections("hero, nope , partners")).toEqual(["hero", "partners"]);
  });

  it("devuelve [] si ninguna key coincide", () => {
    expect(getEnabledHomeSections("xxx,yyy")).toEqual([]);
  });
});
