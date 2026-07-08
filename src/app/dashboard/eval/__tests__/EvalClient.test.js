import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent, within } from "@testing-library/react";

// ── Mocks ────────────────────────────────────────────────────────────────────
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

const isAuthenticated = vi.fn();
vi.mock("../../../../lib/session", () => ({
  isAuthenticated: (...a) => isAuthenticated(...a),
}));

const getEvalCategories = vi.fn();
const getEvalCourses = vi.fn();
const getEvalStatus = vi.fn();
const beginEval = vi.fn();
const gradeEval = vi.fn();
const saveEval = vi.fn();
const getEvalHistory = vi.fn();
vi.mock("../../../../lib/api", () => ({
  getEvalCategories: (...a) => getEvalCategories(...a),
  getEvalCourses: (...a) => getEvalCourses(...a),
  getEvalStatus: (...a) => getEvalStatus(...a),
  beginEval: (...a) => beginEval(...a),
  gradeEval: (...a) => gradeEval(...a),
  saveEval: (...a) => saveEval(...a),
  getEvalHistory: (...a) => getEvalHistory(...a),
}));

import EvalClient from "../EvalClient";

afterEach(cleanup);
beforeEach(() => {
  replace.mockClear();
  isAuthenticated.mockReset();
  getEvalCategories.mockReset();
  getEvalCourses.mockReset();
  getEvalStatus.mockReset();
  beginEval.mockReset();
  gradeEval.mockReset();
  saveEval.mockReset();
  getEvalHistory.mockReset();
});

describe("EvalClient — auth guard", () => {
  it("redirects to login when there is no session", () => {
    isAuthenticated.mockReturnValue(false);
    render(<EvalClient />);
    expect(replace).toHaveBeenCalledWith("/login?next=/dashboard/eval");
  });
});

describe("EvalClient — full step wizard (select -> quiz -> results -> history)", () => {
  beforeEach(() => {
    isAuthenticated.mockReturnValue(true);
    getEvalCategories.mockResolvedValue({
      categories: [{ id: 1, name: "Front of House" }],
    });
    getEvalCourses.mockResolvedValue({
      courses: [{ id: 5, name: "Guest Service Basics" }],
    });
    getEvalStatus.mockResolvedValue({
      attempts_used: 0,
      max: 3,
      can_start: true,
    });
    beginEval.mockResolvedValue({
      attempt_id: 42,
      questions: [
        {
          id: 101,
          qtype: "truefalse",
          text: "Guests should always be greeted within 30 seconds.",
          answers: [
            { id: 1, text: "True" },
            { id: 2, text: "False" },
          ],
        },
      ],
    });
    gradeEval.mockResolvedValue({
      percent: 80,
      results: [
        {
          question_id: 101,
          your_answer: 1,
          correct_answer: 1,
          is_correct: true,
          feedback: "Nice work.",
        },
      ],
    });
    saveEval.mockResolvedValue({ saved: true });
    getEvalHistory.mockResolvedValue({
      history: [
        {
          id: 900,
          course_name: "Guest Service Basics",
          date: "2026-07-08",
          score: 80,
          questions_count: 1,
        },
      ],
    });
  });

  it("walks the whole wizard and hits every API function with the right args", async () => {
    render(<EvalClient />);

    // select: category -> course -> status
    const categorySelect = await screen.findByRole("combobox");
    fireEvent.change(categorySelect, { target: { value: "1" } });
    expect(getEvalCourses).toHaveBeenCalledWith("1");

    const beginBtn = await screen.findByRole("button", { name: /begin/i });
    await waitFor(() => expect(getEvalStatus).toHaveBeenCalledWith(5));
    await waitFor(() => expect(beginBtn).not.toBeDisabled());

    fireEvent.click(beginBtn);
    await waitFor(() => expect(beginEval).toHaveBeenCalledWith(5));

    // quiz: answer the single question, then submit
    const trueOption = await screen.findByLabelText("True");
    fireEvent.click(trueOption);
    const sendBtn = screen.getByRole("button", { name: /send answers/i });
    fireEvent.click(sendBtn);

    await waitFor(() =>
      expect(gradeEval).toHaveBeenCalledWith(5, { 101: [1] })
    );

    // results: score + per-question feedback rendered
    await screen.findByText(/nice work/i);
    expect(screen.getByText("80%")).toBeInTheDocument();

    const saveBtn = screen.getByRole("button", { name: /^save$/i });
    fireEvent.click(saveBtn);

    await waitFor(() =>
      expect(saveEval).toHaveBeenCalledWith(5, { 101: [1] })
    );

    // history: saved attempt listed with its score
    await waitFor(() => expect(getEvalHistory).toHaveBeenCalled());
    await screen.findByText("Guest Service Basics");
    const historyHeading = screen.getByRole("heading", { name: /history/i });
    const historySection = historyHeading.closest("section");
    expect(within(historySection).getByText("80%")).toBeInTheDocument();
  });

  it("disables Begin and shows the max-attempts note when can_start is false", async () => {
    getEvalStatus.mockResolvedValue({
      attempts_used: 3,
      max: 3,
      can_start: false,
    });
    render(<EvalClient />);
    const categorySelect = await screen.findByRole("combobox");
    fireEvent.change(categorySelect, { target: { value: "1" } });

    const beginBtn = await screen.findByRole("button", { name: /begin/i });
    await waitFor(() => expect(beginBtn).toBeDisabled());
    expect(
      screen.getByText(/maximum number of attempts/i)
    ).toBeInTheDocument();
  });
});
