import { describe, it, expect } from "vitest";
import { appendWantsurl } from "./api";

describe("appendWantsurl", () => {
  it("agrega wantsurl con & cuando el loginurl ya tiene query", () => {
    const out = appendWantsurl(
      "https://moodle.test/auth/userkey/login.php?key=ABC",
      "https://moodle.test/course/view.php?id=7"
    );
    expect(out).toBe(
      "https://moodle.test/auth/userkey/login.php?key=ABC&wantsurl=" +
        encodeURIComponent("https://moodle.test/course/view.php?id=7")
    );
  });

  it("usa ? cuando el loginurl no tiene query", () => {
    expect(appendWantsurl("https://m.test/login", "https://m.test/course/view.php?id=1")).toBe(
      "https://m.test/login?wantsurl=" +
        encodeURIComponent("https://m.test/course/view.php?id=1")
    );
  });

  it("devuelve el loginurl intacto si no hay destino", () => {
    expect(appendWantsurl("https://m.test/login?key=X", undefined)).toBe(
      "https://m.test/login?key=X"
    );
    expect(appendWantsurl("https://m.test/login?key=X", "")).toBe(
      "https://m.test/login?key=X"
    );
  });

  it("devuelve el valor tal cual si el loginurl es vacío/nulo", () => {
    expect(appendWantsurl("", "https://x")).toBe("");
    expect(appendWantsurl(undefined, "https://x")).toBe(undefined);
  });
});
