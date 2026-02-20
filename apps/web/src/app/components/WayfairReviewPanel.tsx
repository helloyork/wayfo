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

export function WayfairReviewPanel({ runId }: { runId: string }) {
  const [submissions, setSubmissions] = useState<Submission[] | null>(null);
  const [suggestions, setSuggestions] = useState<RepairSuggestion[] | null>(null);
  const [requestText, setRequestText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitStatus, setSubmitStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [submissionsRes, requestRes] = await Promise.all([
        fetch(`${apiBase}/api/runs/${runId}/wayfair/submissions`, { cache: "no-store" }).then((res) =>
          res.json()
        ),
        fetch(`${apiBase}/api/runs/${runId}/wayfair/request`, { cache: "no-store" }).then((res) =>
          res.json()
        )
      ]);
      setSubmissions(submissionsRes.submissions ?? null);
      setSuggestions(submissionsRes.suggestions ?? null);
      setRequestText(JSON.stringify(requestRes.request ?? {}, null, 2));
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

  const flaws = submissions?.flatMap((item) => item.validationFlaws ?? []) ?? [];

  return (
    <div className="card stack">
      <div className="row">
        <strong>Wayfair 审查与修复</strong>
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn" onClick={loadData} disabled={loading}>
            刷新
          </button>
          <button type="button" className="btn" onClick={handleSubmit} disabled={loading}>
            提交修正
          </button>
        </div>
      </div>
      {loading ? <div className="muted">加载中...</div> : null}
      {error ? <div className="badge badge-danger">{error}</div> : null}
      {submitStatus ? <div className="badge badge-success">{submitStatus}</div> : null}

      <div className="list">
        {(submissions ?? []).length === 0 ? (
          <div className="empty">暂无 submissions 数据</div>
        ) : (
          (submissions ?? []).map((item) => (
            <div key={item.requestId} className="list-item">
              <div className="row">
                <span className="badge">{item.status}</span>
                <span className="muted">{item.requestId}</span>
              </div>
              <div className="muted">
                validation: {item.validationStatus ?? "N/A"} | submission:{" "}
                {item.submissionStatus ?? "N/A"} | flaws: {item.validationFlaws?.length ?? 0}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="card stack">
        <strong>Validation Flaws</strong>
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

      <div className="card stack">
        <strong>Agent 修复建议</strong>
        {(suggestions ?? []).length === 0 ? (
          <div className="empty">暂无建议</div>
        ) : (
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
        )}
      </div>

      <div className="card stack">
        <strong>提交请求（可编辑 JSON）</strong>
        <textarea
          className="textarea"
          rows={16}
          value={requestText}
          onChange={(event) => setRequestText(event.target.value)}
        />
      </div>
    </div>
  );
}
