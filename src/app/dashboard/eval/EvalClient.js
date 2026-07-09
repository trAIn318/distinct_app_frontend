"use client";

/**
 * EvalClient — asistente de evaluaciones en un solo componente, con una
 * máquina de estados `step`: "select" -> "quiz" -> "results" -> "history".
 * Guard de autenticación y patrón de carga calcados de AccountClient
 * (src/app/account/AccountClient.js): isAuthenticated()/getCurrentUser() al
 * montar, router.replace("/login?next=...") si no hay sesión, useT() por
 * namespace, try/catch con err.message del backend como mensaje preferente.
 *
 * Nombres de campo del backend: contrato real confirmado (Task 14, fix pass)
 * — getEvalCategories -> {categories:[{id,name,code}]}
 * — getEvalCourses    -> {courses:[{course_id,name,code}]}
 * — getEvalStatus     -> {attempts_used,max_attempts,questions_to_select,can_start,last_result}
 * — beginEval         -> {attempt_number,questions:[{question_id,question_text,qtype,options:[{answer_id,text}]}]}
 * — gradeEval         -> {score,total,correct,results:[{question_id,question_text,selected,correct_answers,is_correct,feedback}]}
 * — saveEval          -> {evaluation_id,attempt_number,score,total}
 * — getEvalHistory    -> {attempts:[{evaluation_id,course_name,attempt_number,score,total_questions,created_at}]}
 * `score` en status/resultados/historial ya viene como porcentaje 0-100
 * (el backend calcula `round(100*correct/total, 2)`), se pasa directo al
 * <Donut percent={...} /> sin dividir por `total` ni inventar un campo
 * `percent`. Las funciones helper de abajo leen estos nombres exactos.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getEvalCategories,
  getEvalCourses,
  getEvalStatus,
  beginEval,
  gradeEval,
  saveEval,
  getEvalHistory,
} from "../../../lib/api";
import { isAuthenticated } from "../../../lib/session";
import { isMultiSelect } from "../../../lib/eval";
import Donut from "../../../components/Donut";
import { useT } from "../../../i18n/client";
import styles from "./page.module.css";

// ── Extracción defensiva de campos (ver nota de cabecera) ──────────────────

function pickList(data, key) {
  if (Array.isArray(data)) return data;
  return data?.[key] ?? [];
}

function entityId(o) {
  return o?.id ?? o?.course_id ?? o?.category_id;
}

function entityName(o) {
  return o?.name ?? o?.title ?? o?.fullname ?? "";
}

function statusFields(s) {
  return {
    attemptsUsed: s?.attempts_used ?? 0,
    maxAttempts: s?.max ?? s?.max_attempts ?? null,
    canStart: s?.can_start !== undefined ? Boolean(s.can_start) : true,
    configured: s?.configured !== false,
    lastScore:
      s?.last_score ?? s?.last_result?.score ?? s?.best_score ?? null,
  };
}

function questionId(q) {
  return q?.id ?? q?.question_id;
}

function questionType(q) {
  return q?.qtype ?? q?.type ?? "";
}

function questionText(q) {
  return q?.question_text ?? "";
}

function questionOptions(q) {
  return q?.options ?? [];
}

function answerId(a) {
  return a?.answer_id;
}

function answerText(a) {
  return a?.text ?? "";
}

function pickResults(data) {
  return data?.results ?? [];
}

function resultFields(r) {
  return {
    questionId: r?.question_id,
    questionText: r?.question_text ?? "",
    yourAnswer: r?.selected ?? [],
    correctAnswer: r?.correct_answers ?? [],
    isCorrect: Boolean(r?.is_correct),
    feedback: r?.feedback ?? "",
  };
}

function historyFields(h, idx) {
  return {
    id: h?.evaluation_id ?? idx,
    courseName: h?.course_name ?? "",
    date: h?.created_at ?? "",
    score: h?.score ?? 0,
    questionsCount: h?.total_questions ?? null,
  };
}

/**
 * Resuelve un valor de respuesta (id de answer, lista de ids, o texto ya
 * resuelto por el backend) a texto legible, buscando el id en las preguntas
 * del intento actual. Si no hay match, muestra el valor tal cual.
 */
function formatAnswerValue(value, questions) {
  if (value == null || value === "") return "";
  const values = Array.isArray(value) ? value : [value];
  const texts = values.map((v) => {
    for (const q of questions) {
      const match = questionOptions(q).find(
        (a) => String(answerId(a)) === String(v)
      );
      if (match) return answerText(match);
    }
    return String(v);
  });
  return texts.join(", ");
}

export default function EvalClient() {
  const t = useT("eval");
  const router = useRouter();
  const [ready, setReady] = useState(false);

  const [step, setStep] = useState("select");

  // select
  const [categories, setCategories] = useState(null);
  const [categoriesError, setCategoriesError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [courses, setCourses] = useState(null);
  const [coursesError, setCoursesError] = useState(null);
  const [statuses, setStatuses] = useState({});
  const [statusesLoading, setStatusesLoading] = useState(false);
  const [beginningId, setBeginningId] = useState(null);
  const [beginError, setBeginError] = useState(null);

  // quiz
  const [quizCourseId, setQuizCourseId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [grading, setGrading] = useState(false);
  const [gradeError, setGradeError] = useState(null);

  // results
  const [results, setResults] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // history
  const [history, setHistory] = useState(null);
  const [historyError, setHistoryError] = useState(null);
  const [justSaved, setJustSaved] = useState(false);

  // Página privada: sin sesión, a login con ?next= (mismo patrón que
  // AccountClient.js).
  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login?next=/dashboard/eval");
      return;
    }
    setReady(true);
  }, [router]);

  // Categorías al montar.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setCategoriesError(null);
    getEvalCategories()
      .then((data) => {
        if (cancelled) return;
        setCategories(pickList(data, "categories"));
      })
      .catch((err) => {
        if (cancelled) return;
        setCategoriesError(err.message || t("unavailable"));
        setCategories([]);
      });
    return () => {
      cancelled = true;
    };
    // `t` de useT() es una nueva función en cada render (no memoizada);
    // incluirla en deps reengancharía el efecto en bucle. Solo se necesita
    // `ready`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Cursos + status de cada uno cuando cambia la categoría.
  useEffect(() => {
    if (!ready || !selectedCategory) {
      setCourses(null);
      setStatuses({});
      return;
    }
    let cancelled = false;
    setCourses(null);
    setCoursesError(null);
    setStatuses({});
    getEvalCourses(selectedCategory)
      .then(async (data) => {
        if (cancelled) return;
        const list = pickList(data, "courses");
        setCourses(list);
        if (list.length === 0) return;
        setStatusesLoading(true);
        const entries = await Promise.all(
          list.map(async (c) => {
            const id = entityId(c);
            try {
              const s = await getEvalStatus(id);
              return [id, statusFields(s)];
            } catch (err) {
              return [id, { error: err.message || t("unavailable") }];
            }
          })
        );
        if (cancelled) return;
        setStatuses(Object.fromEntries(entries));
        setStatusesLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setCoursesError(err.message || t("unavailable"));
        setCourses([]);
      });
    return () => {
      cancelled = true;
    };
    // ver nota de `t` en el efecto anterior.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, selectedCategory]);

  // Historial: recargar cada vez que se entra al paso "history" (puede haber
  // un intento nuevo recién guardado).
  useEffect(() => {
    if (step !== "history") return;
    let cancelled = false;
    setHistoryError(null);
    getEvalHistory()
      .then((data) => {
        if (cancelled) return;
        setHistory(pickList(data, "attempts"));
      })
      .catch((err) => {
        if (cancelled) return;
        setHistoryError(err.message || t("unavailable"));
        setHistory([]);
      });
    return () => {
      cancelled = true;
    };
    // ver nota de `t` en el primer efecto de esta sección.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  if (!ready) return null;

  function handleCategoryChange(e) {
    setSelectedCategory(e.target.value);
  }

  async function handleBegin(courseId) {
    setBeginError(null);
    setBeginningId(courseId);
    try {
      const data = await beginEval(courseId);
      setQuizCourseId(courseId);
      setQuestions(pickList(data, "questions"));
      setAnswers({});
      setGradeError(null);
      setStep("quiz");
    } catch (err) {
      setBeginError(err.message || t("unavailable"));
    } finally {
      setBeginningId(null);
    }
  }

  function handleSingleAnswer(qId, aId) {
    setAnswers((prev) => ({ ...prev, [qId]: [aId] }));
  }

  function handleMultiAnswer(qId, aId, checked) {
    setAnswers((prev) => {
      const current = prev[qId] || [];
      const next = checked
        ? [...current, aId]
        : current.filter((v) => v !== aId);
      return { ...prev, [qId]: next };
    });
  }

  function handleBackToSelect() {
    setQuizCourseId(null);
    setQuestions([]);
    setAnswers({});
    setBeginError(null);
    setGradeError(null);
    setStep("select");
  }

  async function handleSendAnswers() {
    setGradeError(null);
    setGrading(true);
    try {
      const data = await gradeEval(quizCourseId, answers);
      setResults(data);
      setSaveError(null);
      setStep("results");
    } catch (err) {
      setGradeError(err.message || t("unavailable"));
    } finally {
      setGrading(false);
    }
  }

  async function handleSave() {
    setSaveError(null);
    setSaving(true);
    try {
      await saveEval(quizCourseId, answers);
      setJustSaved(true);
      setStep("history");
    } catch (err) {
      setSaveError(err.message || t("unavailable"));
    } finally {
      setSaving(false);
    }
  }

  function handleCancelResults() {
    setResults(null);
    setQuizCourseId(null);
    setQuestions([]);
    setAnswers({});
    setStep("select");
  }

  function handleGoToHistory() {
    setJustSaved(false);
    setStep("history");
  }

  return (
    <>
      {step === "select" && (
        <section className={styles.card}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>{t("selectCategory")}</span>
            {categories === null ? (
              <p className={styles.muted}>{t("loading")}</p>
            ) : categoriesError ? (
              <div className={styles.error} role="alert">
                {categoriesError}
              </div>
            ) : (
              <select
                className={styles.select}
                value={selectedCategory}
                onChange={handleCategoryChange}
              >
                <option value="">{t("selectCategory")}</option>
                {categories.map((c) => (
                  <option key={entityId(c)} value={entityId(c)}>
                    {entityName(c)}
                  </option>
                ))}
              </select>
            )}
          </label>

          {selectedCategory && (
            <div className={styles.courseSection}>
              <h2 className={styles.cardTitle}>{t("selectCourse")}</h2>
              {courses === null ? (
                <p className={styles.muted}>{t("loading")}</p>
              ) : coursesError ? (
                <div className={styles.error} role="alert">
                  {coursesError}
                </div>
              ) : courses.length === 0 ? (
                <p className={styles.muted}>{t("noCourses")}</p>
              ) : (
                <ul className={styles.courseList}>
                  {courses.map((c) => {
                    const cid = entityId(c);
                    const st = statuses[cid];
                    const stillLoading = statusesLoading && !st;
                    const disabled =
                      !st ||
                      Boolean(st.error) ||
                      st.configured === false ||
                      st.canStart === false ||
                      beginningId === cid;
                    return (
                      <li key={cid} className={styles.courseItem}>
                        <div className={styles.courseInfo}>
                          <span className={styles.courseName}>
                            {entityName(c)}
                          </span>
                          {stillLoading ? (
                            <span className={styles.muted}>
                              {t("loading")}
                            </span>
                          ) : st?.error ? (
                            <span className={styles.error} role="alert">
                              {st.error}
                            </span>
                          ) : st ? (
                            <>
                              <span className={styles.attemptsLine}>
                                {t("attempt")} {st.attemptsUsed}
                                {st.maxAttempts != null
                                  ? ` ${t("of")} ${st.maxAttempts}`
                                  : ""}
                              </span>
                              {st.configured === false && (
                                <span className={styles.muted}>
                                  {t("noConfig")}
                                </span>
                              )}
                              {st.configured !== false &&
                                st.canStart === false && (
                                  <>
                                    <span className={styles.muted}>
                                      {t("maxReached")}
                                    </span>
                                    {st.lastScore != null && (
                                      <span className={styles.muted}>
                                        {t("lastResult")}:{" "}
                                        {Math.round(st.lastScore)}%
                                      </span>
                                    )}
                                  </>
                                )}
                            </>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => handleBegin(cid)}
                          disabled={disabled}
                        >
                          {beginningId === cid ? t("loading") : t("begin")}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {beginError && (
            <div className={styles.error} role="alert">
              {beginError}
            </div>
          )}

          <div className={styles.selectFooter}>
            <button
              type="button"
              className={styles.ghostButton}
              onClick={handleGoToHistory}
            >
              {t("history")}
            </button>
          </div>
        </section>
      )}

      {step === "quiz" && (
        <section className={styles.card}>
          <button
            type="button"
            className={styles.backLink}
            onClick={handleBackToSelect}
          >
            {t("back")}
          </button>

          {questions.length === 0 ? (
            <p className={styles.muted}>{t("loading")}</p>
          ) : (
            <form
              className={styles.quizForm}
              onSubmit={(e) => {
                e.preventDefault();
                handleSendAnswers();
              }}
            >
              {questions.map((q, idx) => {
                const qId = questionId(q);
                const multi = isMultiSelect(questionType(q));
                const selected = (answers[qId] || []).map(String);
                return (
                  <fieldset key={qId} className={styles.questionBlock}>
                    <legend className={styles.questionLegend}>
                      {t("question")} {idx + 1} {t("of")} {questions.length}
                    </legend>
                    <p className={styles.questionText}>{questionText(q)}</p>
                    <div className={styles.answerList}>
                      {questionOptions(q).map((a) => {
                        const aId = answerId(a);
                        const checked = selected.includes(String(aId));
                        return (
                          <label key={aId} className={styles.answerOption}>
                            <input
                              type={multi ? "checkbox" : "radio"}
                              name={`q-${qId}`}
                              className={styles.answerInput}
                              checked={checked}
                              onChange={(e) =>
                                multi
                                  ? handleMultiAnswer(
                                      qId,
                                      aId,
                                      e.target.checked
                                    )
                                  : handleSingleAnswer(qId, aId)
                              }
                            />
                            <span>{answerText(a)}</span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                );
              })}

              {gradeError && (
                <div className={styles.error} role="alert">
                  {gradeError}
                </div>
              )}

              <button
                type="submit"
                className="btn-primary"
                disabled={grading}
              >
                {grading ? t("loading") : t("sendAnswers")}
              </button>
            </form>
          )}
        </section>
      )}

      {step === "results" && results && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>{t("yourScore")}</h2>
          <div className={styles.scoreRow}>
            <Donut percent={results?.score ?? 0} size={128} />
          </div>

          <ul className={styles.resultsList}>
            {pickResults(results).map((r, idx) => {
              const rf = resultFields(r);
              return (
                <li key={rf.questionId ?? idx} className={styles.resultItem}>
                  {rf.questionText && (
                    <p className={styles.questionText}>{rf.questionText}</p>
                  )}
                  <span
                    className={
                      rf.isCorrect
                        ? styles.correctBadge
                        : styles.incorrectBadge
                    }
                  >
                    {rf.isCorrect ? t("correct") : t("incorrect")}
                  </span>
                  <div className={styles.resultDetail}>
                    <span className={styles.detailLabel}>
                      {t("yourAnswer")}
                    </span>
                    <span className={styles.detailValue}>
                      {formatAnswerValue(rf.yourAnswer, questions)}
                    </span>
                  </div>
                  <div className={styles.resultDetail}>
                    <span className={styles.detailLabel}>
                      {t("correctAnswer")}
                    </span>
                    <span className={styles.detailValue}>
                      {formatAnswerValue(rf.correctAnswer, questions)}
                    </span>
                  </div>
                  {rf.feedback && (
                    <p className={styles.feedback}>{rf.feedback}</p>
                  )}
                </li>
              );
            })}
          </ul>

          {saveError && (
            <div className={styles.error} role="alert">
              {saveError}
            </div>
          )}

          <div className={styles.actionsRow}>
            <button
              type="button"
              className={styles.ghostButton}
              onClick={handleCancelResults}
            >
              {t("cancel")}
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? t("loading") : t("save")}
            </button>
          </div>
        </section>
      )}

      {step === "history" && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>{t("history")}</h2>

          {justSaved && (
            <div className={styles.success} role="status">
              {t("saved")}
            </div>
          )}

          {history === null ? (
            <p className={styles.muted}>{t("loading")}</p>
          ) : historyError ? (
            <div className={styles.error} role="alert">
              {historyError}
            </div>
          ) : history.length === 0 ? (
            <p className={styles.muted}>{t("noHistory")}</p>
          ) : (
            <ul className={styles.historyList}>
              {history.map((h, idx) => {
                const hf = historyFields(h, idx);
                return (
                  <li key={hf.id} className={styles.historyItem}>
                    <Donut percent={hf.score} size={72} />
                    <div className={styles.historyInfo}>
                      {hf.courseName && (
                        <span className={styles.courseName}>
                          {hf.courseName}
                        </span>
                      )}
                      {hf.date && (
                        <span className={styles.muted}>
                          {t("date")}: {hf.date}
                        </span>
                      )}
                      {hf.questionsCount != null && (
                        <span className={styles.muted}>
                          {hf.questionsCount} {t("questions")}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <button
            type="button"
            className={styles.ghostButton}
            onClick={() => {
              setJustSaved(false);
              setStep("select");
            }}
          >
            {t("back")}
          </button>
        </section>
      )}
    </>
  );
}
