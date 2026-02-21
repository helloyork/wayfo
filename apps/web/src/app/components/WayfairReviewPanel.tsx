"use client";

import { useCallback, useEffect, useState } from "react";
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
      setSubmissions(submissionsRes.submissions ?? null);
      setSuggestions(submissionsRes.suggestions ?? null);
      const draft = draftRes?.draft ?? null;
      const baseRequest = draft ?? requestRes.request ?? {};
      setDraftRequest(baseRequest);
      setRequestText(JSON.stringify(baseRequest, null, 2));
      setQuestions(questionsRes.questions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSubmit = async () => {
    setSubmitStatus(null);
    setError(null);
    setDraftStatus(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(requestText);
    } catch (err) {
      setError("提交失败：JSON 无法解析");
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
      setSubmitStatus("已提交修正，正在重新轮询");
      void loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败");
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

  const updateAnswerForQuestion = (question: Question, value: string) => {
    if (!draftRequest) {
      return;
    }
    const next = JSON.parse(JSON.stringify(draftRequest)) as WayfairRequest;
    const parts = getParts(next);
    const trimmed = value.trim();
    const values = trimmed.length > 0 ? trimmed.split(",").map((item) => item.trim()).filter(Boolean) : [];
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
  };

  const questionRows = flattenQuestions(questions)
    .filter((question) => question.isActive !== false)
    .map((question) => {
      const parts = getParts(draftRequest);
      const allAnswers = parts.flatMap((part) => part.answers ?? []);
      const answers = allAnswers.filter((answer) => answer.questionId === question.id);
      const valueText = answers.map((answer) => answer.value).join(", ");
      return { question, valueText };
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
          <button type="button" className="btn" onClick={handleSubmit} disabled={loading}>
            提交修正
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
            {questionRows.map((row) => (
              <div key={row.question.id} className="list-item">
                <div className="row">
                  <span>{row.question.displayName ?? row.question.id}</span>
                  <span className="muted">{row.question.id}</span>
                </div>
                <input
                  className="input"
                  value={row.valueText}
                  placeholder="输入值（多值请用逗号分隔）"
                  autoComplete="off"
                  onChange={(event) => updateAnswerForQuestion(row.question, event.target.value)}
                />
              </div>
            ))}
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
          onChange={(event) => setRequestText(event.target.value)}
        />
      </details>
    </div>
  );
}
