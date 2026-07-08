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
      categories: [{ id: 1, name: "Front of House", code: "FOH" }],
    });
    getEvalCourses.mockResolvedValue({
      courses: [{ course_id: 5, name: "Guest Service Basics", code: "GSB" }],
    });
    getEvalStatus.mockResolvedValue({
      attempts_used: 0,
      max_attempts: 3,
      questions_to_select: 1,
      can_start: true,
      last_result: null,
    });
    beginEval.mockResolvedValue({
      attempt_number: 1,
      questions: [
        {
          question_id: 101,
          qtype: "truefalse",
          question_text: "Guests should always be greeted within 30 seconds.",
          options: [
            { answer_id: 1, text: "True" },
            { answer_id: 2, text: "False" },
          ],
        },
      ],
    });
    gradeEval.mockResolvedValue({
      score: 80,
      total: 1,
      correct: 1,
      results: [
        {
          question_id: 101,
          question_text: "Guests should always be greeted within 30 seconds.",
          selected: [1],
          correct_answers: [1],
          is_correct: true,
          feedback: "Nice work.",
        },
      ],
    });
    saveEval.mockResolvedValue({
      evaluation_id: 900,
      attempt_number: 1,
      score: 80,
      total: 1,
    });
    getEvalHistory.mockResolvedValue({
      attempts: [
        {
          evaluation_id: 900,
          course_name: "Guest Service Basics",
          attempt_number: 1,
          score: 80,
          total_questions: 1,
          created_at: "2026-07-08",
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

    // quiz: question text + answer option text render from the real
    // contract fields (question_text / options[].text), then submit.
    await screen.findByText(
      "Guests should always be greeted within 30 seconds."
    );
    const trueOption = await screen.findByLabelText("True");
    fireEvent.click(trueOption);
    const sendBtn = screen.getByRole("button", { name: /send answers/i });
    fireEvent.click(sendBtn);

    await waitFor(() =>
      expect(gradeEval).toHaveBeenCalledWith(5, { 101: [1] })
    );

    // results: score (0-100 percent, passed straight to the Donut) +
    // per-question correct/incorrect + feedback rendered.
    await screen.findByText(/nice work/i);
    expect(screen.getByText("80%")).toBeInTheDocument();
    expect(screen.getByText(/^correct$/i)).toBeInTheDocument();

    const saveBtn = screen.getByRole("button", { name: /^save$/i });
    fireEvent.click(saveBtn);

    await waitFor(() =>
      expect(saveEval).toHaveBeenCalledWith(5, { 101: [1] })
    );

    // history: saved attempt listed with its course_name and score donut,
    // read from the `attempts` envelope.
    await waitFor(() => expect(getEvalHistory).toHaveBeenCalled());
    await screen.findByText("Guest Service Basics");
    const historyHeading = screen.getByRole("heading", { name: /history/i });
    const historySection = historyHeading.closest("section");
    expect(within(historySection).getByText("80%")).toBeInTheDocument();
  });

  it("shows the empty-history message when the user has no attempts", async () => {
    getEvalHistory.mockResolvedValue({ attempts: [] });
    render(<EvalClient />);

    const historyBtn = await screen.findByRole("button", { name: /^history$/i });
    fireEvent.click(historyBtn);

    await waitFor(() => expect(getEvalHistory).toHaveBeenCalled());
    expect(
      await screen.findByText(/haven't taken any evaluations yet/i)
    ).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("disables Begin and shows the max-attempts note when can_start is false", async () => {
    getEvalStatus.mockResolvedValue({
      attempts_used: 3,
      max_attempts: 3,
      questions_to_select: 1,
      can_start: false,
      last_result: null,
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
