"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiBase } from "../../lib/api";

type Submission = {
  requestId: string;
  status: string;
  validationStatus?: string | null;
  submissionStatus?: string | null;
  validationFlaws?: Array<{
    questionId: string;
    flawType?: string;
    flaw: string;
    parentRank?: number | null;
    rank?: number | null;
  }>;
};

type RepairSuggestion = {
  questionId: string;
  flawType?: string;
  flaw: string;
  repairable: boolean;
  reason: string;
  suggestedValues?: string[];
};

type Question = {
  id: string;
  displayName: string;
  answerType?: string | null;
  isActive?: boolean;
  isMultiValue?: boolean;
  possibleAnswers?: Array<{ key?: string | null; value: string }>;
  childQuestions?: Question[];
};

type WayfairRequest = {
  supplierId?: string;
  proposedProductAdditions?: Array<{
    classId?: number;
    marketContext?: unknown;
    parts?: Array<{
      supplierPartNumber?: string;
      answers?: Array<{
        questionId: string;
        value: string;
        parentRank?: number;
        rank?: number;
      }>;
    }>;
  }>;
};

export function WayfairReviewPanel({ runId }: { runId: string }) {
  const [submissions, setSubmissions] = useState<Submission[] | null>(null);
  const [suggestions, setSuggestions] = useState<RepairSuggestion[] | null>(null);
  const [requestText, setRequestText] = useState("");
  const [draftRequest, setDraftRequest] = useState<WayfairRequest | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [draftStatus, setDraftStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitStatus, setSubmitStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const refreshTimerRef = useRef<number | null>(null);
  const refreshInFlightRef = useRef(false);
  const isDirtyRef = useRef(false);
  const submittingRef = useRef(false);

  const updateSubmitStateFromSubmissions = useCallback((items: Submission[] | null) => {
    if (!items || items.length === 0 || !submittingRef.current) {
      return;
    }
    const hasFailed = items.some(
      (item) => item.validationStatus === "FAILED" || item.submissionStatus === "FAILED"
    );
    const hasFlaws = items.some((item) => (item.validationFlaws ?? []).length > 0);
    const allSubmitted = items.every((item) => item.status === "SUBMITTED");
    if (hasFailed || hasFlaws) {
      setSubmitting(false);
      setSubmitStatus("轮询已完成，需要人工修正");
      return;
    }
    if (allSubmitted) {
      setSubmitting(false);
      setSubmitStatus("轮询已完成");
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [submissionsRes, requestRes, questionsRes, draftRes] = await Promise.all([
        fetch(`${apiBase}/api/runs/${runId}/wayfair/submissions`, { cache: "no-store" }).then((res) =>
          res.json()
        ),
        fetch(`${apiBase}/api/runs/${runId}/wayfair/request`, { cache: "no-store" }).then((res) =>
          res.json()
        ),
        fetch(`${apiBase}/api/runs/${runId}/wayfair/questions`, { cache: "no-store" }).then((res) =>
          res.json()
        ),
        fetch(`${apiBase}/api/runs/${runId}/wayfair/draft`, { cache: "no-store" })
          .then((res) => (res.ok ? res.json() : null))
      ]);
      const submissionsPayload = submissionsRes.submissions ?? null;
      setSubmissions(submissionsPayload);
      setSuggestions(submissionsRes.suggestions ?? null);
      updateSubmitStateFromSubmissions(submissionsPayload);
      const draft = draftRes?.draft ?? null;
      const draftUpdatedAt = draftRes?.updatedAt ?? null;
      const requestPayload = requestRes?.request ?? null;
      const requestUpdatedAt = requestRes?.updatedAt ?? null;
      let baseRequest = requestPayload ?? {};
      if (draft) {
        if (!requestUpdatedAt || (draftUpdatedAt && draftUpdatedAt > requestUpdatedAt)) {
          baseRequest = draft;
        }
      }
      setDraftRequest(baseRequest);
      const nextText = JSON.stringify(baseRequest, null, 2);
      setRequestText(nextText);
      isDirtyRef.current = false;
      setQuestions(questionsRes.questions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [runId, updateSubmitStateFromSubmissions]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    submittingRef.current = submitting;
  }, [submitting]);

  const scheduleRefresh = useCallback(() => {
    if (isDirtyRef.current) {
      return;
    }
    if (refreshInFlightRef.current || refreshTimerRef.current !== null) {
      return;
    }
    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      if (isDirtyRef.current) {
        return;
      }
      refreshInFlightRef.current = true;
      loadData()
        .catch(() => undefined)
        .finally(() => {
          refreshInFlightRef.current = false;
        });
    }, 800);
  }, [loadData]);

  useEffect(() => {
    const source = new EventSource(`${apiBase}/api/runs/${runId}/events`);
    source.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as { type?: string; step?: string };
        if (
          parsed.type &&
          [
            "RUN_PROGRESS",
            "JOB_PROGRESS",
            "JOB_FAILED",
            "NEEDS_REVIEW",
            "WAITING_FOR_REVIEW",
            "RUN_COMPLETED"
          ].includes(parsed.type)
        ) {
          scheduleRefresh();
        }
        if (
          submittingRef.current &&
          parsed.type &&
          (parsed.type === "RUN_COMPLETED" ||
            parsed.type === "NEEDS_REVIEW" ||
            parsed.type === "WAITING_FOR_REVIEW" ||
            ((parsed.type === "JOB_PROGRESS" || parsed.type === "JOB_FAILED") &&
              parsed.step === "WAYFAIR_POLL"))
        ) {
          setSubmitting(false);
          setSubmitStatus("轮询已完成");
        }
      } catch {
        // Ignore malformed events
      }
    };
    source.onerror = () => {
      source.close();
    };
    return () => {
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
      }
      source.close();
    };
  }, [runId, scheduleRefresh]);

  const handleSubmit = async () => {
    setSubmitStatus(null);
    setError(null);
    setDraftStatus(null);
    setSubmitting(true);
    let parsed: unknown;
    try {
      parsed = JSON.parse(requestText);
    } catch {
      setError("提交失败：JSON 无法解析");
      setSubmitting(false);
      return;
    }
    try {
      const res = await fetch(`${apiBase}/api/runs/${runId}/wayfair/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request: parsed })
      });
      if (!res.ok) {
        throw new Error(`Request failed: ${res.status}`);
      }
      setSubmitStatus("已提交修正，等待轮询完成");
      void loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败");
      setSubmitting(false);
    }
  };

  const handleSaveDraft = async () => {
    setError(null);
    setDraftStatus(null);
    setSaving(true);
    let parsed: unknown;
    try {
      parsed = JSON.parse(requestText);
    } catch {
      setError("保存失败：JSON 无法解析");
      setSaving(false);
      return;
    }
    try {
      const res = await fetch(`${apiBase}/api/runs/${runId}/wayfair/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request: parsed })
      });
      if (!res.ok) {
        throw new Error(`Request failed: ${res.status}`);
      }
      setDraftStatus("草稿已保存");
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const flaws = submissions?.flatMap((item) => item.validationFlaws ?? []) ?? [];
  const failedQuestionIds = new Set(flaws.map((flaw) => flaw.questionId));

  const flattenQuestions = (items: Question[]): Question[] => {
    const result: Question[] = [];
    const walk = (question: Question) => {
      result.push(question);
      question.childQuestions?.forEach(walk);
    };
    items.forEach(walk);
    return result;
  };

  const getParts = (request: WayfairRequest | null) =>
    request?.proposedProductAdditions?.flatMap((addition) => addition.parts ?? []) ?? [];

  const normalizeValues = (input: string | string[]) => {
    const rawValues = Array.isArray(input) ? input : input.split(",");
    return rawValues.map((item) => item.trim()).filter((item) => item.length > 0);
  };

  const updateAnswerForQuestion = (question: Question, input: string | string[]) => {
    if (!draftRequest) {
      return;
    }
    const next = JSON.parse(JSON.stringify(draftRequest)) as WayfairRequest;
    const parts = getParts(next);
    const values = normalizeValues(input);
    for (const part of parts) {
      part.answers = (part.answers ?? []).filter((answer) => answer.questionId !== question.id);
      if (values.length === 0) {
        continue;
      }
      if (question.isMultiValue || question.answerType === "MULTI_CHOICE") {
        values.forEach((entry, index) => {
          part.answers?.push({
            questionId: question.id,
            value: entry,
            parentRank: index + 1,
            rank: question.answerType === "MULTI_CHOICE" ? index + 1 : undefined
          });
        });
      } else {
        part.answers?.push({ questionId: question.id, value: values[0] });
      }
    }
    setDraftRequest(next);
    setRequestText(JSON.stringify(next, null, 2));
    isDirtyRef.current = true;
  };

  const questionRows = flattenQuestions(questions)
    .filter((question) => question.isActive !== false)
    .map((question) => {
      const parts = getParts(draftRequest);
      const allAnswers = parts.flatMap((part) => part.answers ?? []);
      const answers = allAnswers.filter((answer) => answer.questionId === question.id);
      const selectedValues = answers.map((answer) => answer.value);
      const valueText = selectedValues.join(", ");
      return { question, valueText, selectedValues };
    })
    .sort((a, b) => {
      const aFailed = failedQuestionIds.has(a.question.id);
      const bFailed = failedQuestionIds.has(b.question.id);
      if (aFailed === bFailed) {
        if (!aFailed) {
          const aLabel = a.question.displayName ?? a.question.id;
          const bLabel = b.question.displayName ?? b.question.id;
          return aLabel.localeCompare(bLabel);
        }
        return 0;
      }
      return aFailed ? -1 : 1;
    });

  return (
    <div className="card stack">
      <div className="row">
        <strong>Wayfair 审查与修复</strong>
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn" onClick={loadData} disabled={loading}>
            刷新
          </button>
          <button type="button" className="btn" onClick={handleSaveDraft} disabled={loading || saving}>
            保存草稿
          </button>
          <button type="button" className="btn" onClick={handleSubmit} disabled={loading || submitting}>
            {submitting ? (
              <>
                <span className="spinner" aria-hidden="true" />
                提交中
              </>
            ) : (
              "提交修正"
            )}
          </button>
        </div>
      </div>
      {loading ? <div className="muted">加载中...</div> : null}
      {error ? <div className="badge badge-danger">{error}</div> : null}
      {submitStatus ? <div className="badge badge-success">{submitStatus}</div> : null}
      {draftStatus ? <div className="badge badge-success">{draftStatus}</div> : null}

      <div className="stack">
        <div className="section-title">Validation Flaws</div>
        {flaws.length === 0 ? (
          <div className="empty">暂无 flaws</div>
        ) : (
          <div className="list">
            {flaws.map((flaw, index) => (
              <div key={`${flaw.questionId}-${index}`} className="list-item">
                <div className="row">
                  <span className={`badge ${flaw.flawType === "WARNING" ? "badge-warning" : "badge-danger"}`}>
                    {flaw.flawType ?? "ERROR"}
                  </span>
                  <span>{flaw.questionId}</span>
                </div>
                <div className="muted">{flaw.flaw}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {(suggestions ?? []).length === 0 ? null : (
        <div className="stack">
          <div className="section-title">修复建议</div>
          <div className="list">
            {suggestions?.map((item, index) => (
              <div key={`${item.questionId}-${index}`} className="list-item">
                <div className="row">
                  <span className={`badge ${item.repairable ? "badge-success" : "badge-danger"}`}>
                    {item.repairable ? "可修复" : "需人工"}
                  </span>
                  <span>{item.questionId}</span>
                </div>
                <div className="muted">{item.reason}</div>
                <div className="muted">{item.flaw}</div>
                {item.suggestedValues?.length ? (
                  <div className="muted">建议值: {item.suggestedValues.join(", ")}</div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}

      <details className="stack">
        <summary className="row">
          <span className="section-title">问题 - 回答预览（折叠）</span>
          <span className="muted">点击展开</span>
        </summary>
        {questionRows.length === 0 ? (
          <div className="empty">暂无问题数据</div>
        ) : (
          <div className="list">
            {questionRows.map((row) => {
              const hasChoices = (row.question.possibleAnswers?.length ?? 0) > 0;
              const isMultiChoice = row.question.isMultiValue || row.question.answerType === "MULTI_CHOICE";
              return (
                <div key={row.question.id} className="list-item">
                  <div className="row">
                    <span>{row.question.displayName ?? row.question.id}</span>
                    <span className="muted">{row.question.id}</span>
                  </div>
                  {hasChoices ? (
                    <select
                    className={`input review-input${failedQuestionIds.has(row.question.id) ? " input-error" : ""}`}
                      multiple={isMultiChoice}
                      value={isMultiChoice ? row.selectedValues : row.selectedValues[0] ?? ""}
                      onChange={(event) => {
                        if (isMultiChoice) {
                          const nextValues = Array.from(event.currentTarget.selectedOptions).map(
                            (option) => option.value
                          );
                          updateAnswerForQuestion(row.question, nextValues);
                          return;
                        }
                        updateAnswerForQuestion(row.question, event.currentTarget.value);
                      }}
                    >
                      {isMultiChoice ? null : <option value="">留空</option>}
                      {(row.question.possibleAnswers ?? []).map((option) => (
                        <option key={`${row.question.id}-${option.value}`} value={option.value}>
                          {option.value}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                    className={`input review-input${failedQuestionIds.has(row.question.id) ? " input-error" : ""}`}
                      value={row.valueText}
                      placeholder="输入值（多值请用逗号分隔）"
                      autoComplete="off"
                      onChange={(event) => updateAnswerForQuestion(row.question, event.target.value)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </details>

      <details className="stack">
        <summary className="row">
          <span className="section-title">提交请求（折叠）</span>
          <span className="muted">JSON</span>
        </summary>
        <textarea
          className="textarea"
          rows={16}
          value={requestText}
          onChange={(event) => {
            setRequestText(event.target.value);
            isDirtyRef.current = true;
          }}
        />
      </details>
    </div>
  );
}
