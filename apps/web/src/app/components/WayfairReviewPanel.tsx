"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiBase } from "../../lib/api";
import { RunProductImagePreview } from "./RunProductImagePreview";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Loader2, ChevronDown, ChevronRight, CheckCircle2 } from "lucide-react";
import { motion } from "motion/react";

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
  const [imagePreviewRefreshSig, setImagePreviewRefreshSig] = useState(0);

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
    setImagePreviewRefreshSig(0);
  }, [runId]);

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
          parsed.step &&
          (parsed.step === "SCRAPE_AMAZON" || parsed.step === "IMAGE_GENERATE") &&
          parsed.type &&
          (parsed.type === "JOB_PROGRESS" ||
            parsed.type === "JOB_FAILED" ||
            parsed.type === "JOB_STARTED")
        ) {
          setImagePreviewRefreshSig((n: number) => n + 1);
        }
        if (parsed.type === "RUN_COMPLETED") {
          setImagePreviewRefreshSig((n: number) => n + 1);
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

  const applySuggestion = (suggestion: RepairSuggestion) => {
    if (!suggestion.repairable || !suggestion.suggestedValues?.length) return;
    const question = flattenQuestions(questions).find((q) => q.id === suggestion.questionId);
    if (question) {
      updateAnswerForQuestion(question, suggestion.suggestedValues);
    }
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

  const inputClassName = (failed: boolean) =>
    `flex w-full min-w-0 rounded-md border px-3 py-1 text-sm font-mono shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
      failed ? "border-destructive" : "border-input"
    }`;

  const hasFlaws = flaws.length > 0;
  const hasSuggestions = (suggestions?.length ?? 0) > 0;

  return (
    <Card className="shadow-sm overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle>Wayfair 审查与修复</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {hasFlaws
                ? "存在验证问题，请查看下方详情并修正后提交"
                : "检查并修正后提交至 Wayfair"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={loading}
            >
              刷新
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSaveDraft}
              disabled={loading || saving}
            >
              {saving ? "保存中…" : "保存草稿"}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSubmit}
              disabled={loading || submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  提交中
                </>
              ) : (
                "提交修正"
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <RunProductImagePreview
          runId={runId}
          refreshSignal={imagePreviewRefreshSig}
        />
        {loading ? (
          <div className="text-sm text-muted-foreground">加载中...</div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          {error ? (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Badge variant="destructive">{error}</Badge>
            </motion.div>
          ) : null}
          {submitStatus ? (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {submitStatus}
            </motion.div>
          ) : null}
          {draftStatus ? (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {draftStatus}
            </motion.div>
          ) : null}
        </div>

        {/* Step 1: Validation flaws */}
        <section className="space-y-2">
          <h4 className="text-sm font-medium text-foreground">
            1. 验证问题
            {hasFlaws && (
              <Badge variant="destructive" className="ml-2">
                {flaws.length}
              </Badge>
            )}
          </h4>
          {flaws.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/50 px-4 py-6 text-center text-sm text-muted-foreground">
              暂无验证问题
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {flaws.map((flaw, index) => (
                <motion.div
                  key={`${flaw.questionId}-${index}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                  className="rounded-lg border border-border bg-muted/30 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        flaw.flawType === "WARNING" ? "warning" : "destructive"
                      }
                    >
                      {flaw.flawType ?? "ERROR"}
                    </Badge>
                    <span className="font-mono text-sm">{flaw.questionId}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{flaw.flaw}</p>
                </motion.div>
              ))}
            </div>
          )}
        </section>

        {/* Step 2: Repair suggestions */}
        {hasSuggestions ? (
          <section className="space-y-2">
            <h4 className="text-sm font-medium text-foreground">
              2. 修复建议
              <Badge variant="secondary" className="ml-2">
                {suggestions!.length}
              </Badge>
            </h4>
            <div className="flex flex-col gap-2">
              {suggestions!.map((item, index) => (
                <motion.div
                  key={`${item.questionId}-${index}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                  className="rounded-lg border border-border bg-muted/30 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={item.repairable ? "success" : "destructive"}>
                        {item.repairable ? "可一键修复" : "需人工"}
                      </Badge>
                      <span className="font-mono text-sm">{item.questionId}</span>
                    </div>
                    {item.repairable && item.suggestedValues?.length ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => applySuggestion(item)}
                      >
                        应用建议
                      </Button>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{item.reason}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.flaw}</p>
                  {item.suggestedValues?.length ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      建议值: {item.suggestedValues.join(", ")}
                    </p>
                  ) : null}
                </motion.div>
              ))}
            </div>
          </section>
        ) : null}

        {/* Step 3: Edit answers */}
        <Collapsible defaultOpen={hasFlaws || hasSuggestions}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-2 py-2 text-left text-sm font-medium text-foreground transition-colors hover:text-foreground/80 [&[data-state=open]_svg]:rotate-90"
            >
              <ChevronRight className="h-4 w-4 shrink-0 transition-transform duration-200" />
              <span>3. 问题与回答</span>
              <span className="text-muted-foreground">（编辑后需保存或提交）</span>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <motion.div
              initial={false}
              animate={{ opacity: 1 }}
              className="mt-2 flex flex-col gap-3"
            >
              {questionRows.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-muted/50 px-4 py-6 text-center text-sm text-muted-foreground">
                  暂无问题数据
                </div>
              ) : (
                questionRows.map((row, idx) => {
                  const hasChoices =
                    (row.question.possibleAnswers?.length ?? 0) > 0;
                  const isMultiChoice =
                    row.question.isMultiValue ||
                    row.question.answerType === "MULTI_CHOICE";
                  const failed = failedQuestionIds.has(row.question.id);
                  return (
                    <motion.div
                      key={row.question.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.15, delay: idx * 0.02 }}
                      className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">
                          {row.question.displayName ?? row.question.id}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {row.question.id}
                        </span>
                      </div>
                      {hasChoices ? (
                        <select
                          className={inputClassName(failed)}
                          multiple={isMultiChoice}
                          value={
                            isMultiChoice
                              ? row.selectedValues
                              : row.selectedValues[0] ?? ""
                          }
                          onChange={(event) => {
                            if (isMultiChoice) {
                              const nextValues = Array.from(
                                event.currentTarget.selectedOptions
                              ).map((option) => option.value);
                              updateAnswerForQuestion(row.question, nextValues);
                              return;
                            }
                            updateAnswerForQuestion(
                              row.question,
                              event.currentTarget.value
                            );
                          }}
                        >
                          {isMultiChoice ? null : (
                            <option value="">留空</option>
                          )}
                          {(row.question.possibleAnswers ?? []).map((option) => (
                            <option
                              key={`${row.question.id}-${option.value}`}
                              value={option.value}
                            >
                              {option.value}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <Input
                          className={failed ? "border-destructive" : ""}
                          value={row.valueText}
                          placeholder="输入值（多值请用逗号分隔）"
                          autoComplete="off"
                          onChange={(event) =>
                            updateAnswerForQuestion(
                              row.question,
                              event.target.value
                            )
                          }
                        />
                      )}
                    </motion.div>
                  );
                })
              )}
            </motion.div>
          </CollapsibleContent>
        </Collapsible>

        {/* Step 4: JSON preview */}
        <Collapsible>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-2 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:text-foreground [&[data-state=open]_svg]:rotate-180"
            >
              <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
              <span>4. 提交请求 JSON</span>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Textarea
              className="mt-2 font-mono text-sm"
              rows={16}
              value={requestText}
              onChange={(event) => {
                setRequestText(event.target.value);
                isDirtyRef.current = true;
              }}
            />
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
