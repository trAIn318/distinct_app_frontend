import { describe, it, expect, vi, beforeEach } from "vitest";
import { API_URL } from "../config";

// El helper de auth de api.js lee el token vía getAccessToken() de session.js.
// Mockeamos ese módulo para no depender de cookies/document en jsdom.
const getAccessToken = vi.fn();
vi.mock("../session", () => ({
  getAccessToken: (...a) => getAccessToken(...a),
}));

import {
  getEvalCategories,
  getEvalCourses,
  getEvalStatus,
  beginEval,
  gradeEval,
  saveEval,
  getEvalHistory,
} from "../api";

function jsonResponse(data, { ok = true } = {}) {
  return Promise.resolve({
    ok,
    json: () => Promise.resolve(data),
  });
}

beforeEach(() => {
  getAccessToken.mockReset();
  getAccessToken.mockReturnValue("test-token");
  global.fetch = vi.fn();
});

describe("getEvalCategories", () => {
  it("hace GET a /api/eval/categories/ con el bearer token y devuelve el JSON parseado", async () => {
    const payload = { categories: [{ id: 1, name: "Front of House" }] };
    global.fetch.mockResolvedValue(jsonResponse(payload));

    const result = await getEvalCategories();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe(`${API_URL}/api/eval/categories/`);
    expect(options.method ?? "GET").toBe("GET");
    expect(options.headers.Authorization).toBe("Bearer test-token");
    expect(result).toEqual(payload);
  });
});

describe("getEvalCourses", () => {
  it("hace GET a /api/eval/courses/?category_id=<id>", async () => {
    const payload = { courses: [{ id: 5 }] };
    global.fetch.mockResolvedValue(jsonResponse(payload));

    const result = await getEvalCourses(3);

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe(`${API_URL}/api/eval/courses/?category_id=3`);
    expect(options.method ?? "GET").toBe("GET");
    expect(options.headers.Authorization).toBe("Bearer test-token");
    expect(result).toEqual(payload);
  });
});

describe("getEvalStatus", () => {
  it("hace GET a /api/eval/status/?course_id=<id>", async () => {
    const payload = { status: "not_started" };
    global.fetch.mockResolvedValue(jsonResponse(payload));

    const result = await getEvalStatus(7);

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe(`${API_URL}/api/eval/status/?course_id=7`);
    expect(options.method ?? "GET").toBe("GET");
    expect(options.headers.Authorization).toBe("Bearer test-token");
    expect(result).toEqual(payload);
  });
});

describe("beginEval", () => {
  it("hace POST a /api/eval/begin/ con { course_id } como body JSON", async () => {
    const payload = { attempt_id: 42, questions: [] };
    global.fetch.mockResolvedValue(jsonResponse(payload));

    const result = await beginEval(7);

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe(`${API_URL}/api/eval/begin/`);
    expect(options.method).toBe("POST");
    expect(options.headers.Authorization).toBe("Bearer test-token");
    expect(options.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(options.body)).toEqual({ course_id: 7 });
    expect(result).toEqual(payload);
  });
});

describe("gradeEval", () => {
  it("hace POST a /api/eval/grade/ con { course_id, answers } como body JSON", async () => {
    const answers = { 101: [1, 2], 102: [5] };
    const payload = { score: 80, passed: true };
    global.fetch.mockResolvedValue(jsonResponse(payload));

    const result = await gradeEval(7, answers);

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe(`${API_URL}/api/eval/grade/`);
    expect(options.method).toBe("POST");
    expect(options.headers.Authorization).toBe("Bearer test-token");
    expect(JSON.parse(options.body)).toEqual({ course_id: 7, answers });
    expect(result).toEqual(payload);
  });
});

describe("saveEval", () => {
  it("hace POST a /api/eval/save/ con { course_id, answers } como body JSON", async () => {
    const answers = { 101: [1] };
    const payload = { saved: true };
    global.fetch.mockResolvedValue(jsonResponse(payload));

    const result = await saveEval(7, answers);

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe(`${API_URL}/api/eval/save/`);
    expect(options.method).toBe("POST");
    expect(options.headers.Authorization).toBe("Bearer test-token");
    expect(JSON.parse(options.body)).toEqual({ course_id: 7, answers });
    expect(result).toEqual(payload);
  });
});

describe("getEvalHistory", () => {
  it("hace GET a /api/eval/history/", async () => {
    const payload = { history: [{ course_id: 1, score: 90 }] };
    global.fetch.mockResolvedValue(jsonResponse(payload));

    const result = await getEvalHistory();

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe(`${API_URL}/api/eval/history/`);
    expect(options.method ?? "GET").toBe("GET");
    expect(options.headers.Authorization).toBe("Bearer test-token");
    expect(result).toEqual(payload);
  });
});

describe("manejo de errores", () => {
  it("lanza con el detail del backend cuando la respuesta no es ok", async () => {
    global.fetch.mockResolvedValue(
      jsonResponse({ detail: "Course not found." }, { ok: false })
    );

    await expect(getEvalStatus(999)).rejects.toThrow("Course not found.");
  });

  it("lanza si no hay sesión iniciada (sin token)", async () => {
    getAccessToken.mockReturnValue(null);

    await expect(getEvalCategories()).rejects.toThrow(/signed in/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
