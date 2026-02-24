"use client";

import { useEffect, useMemo, useState } from "react";
import { apiBase } from "../../lib/api";

type ProgressStep = {
  step: string;
  title: string;
};

type RunProgressPanelProps = {
  runId: string;
  steps: ProgressStep[];
  initialStatus: string;
  initialStep?: string;
};

export function RunProgressPanel({ runId, steps, initialStatus, initialStep }: RunProgressPanelProps) {
  const [status, setStatus] = useState(initialStatus);
  const [currentStep, setCurrentStep] = useState(initialStep ?? "");

  const { percent, currentTitle } = useMemo(() => {
    if (status === "COMPLETED") {
      return { percent: 100, currentTitle: "完成" };
    }
    const waitingReview = status === "NEEDS_REVIEW" || status === "WAITING_FOR_REVIEW";
    const index = steps.findIndex((step) => step.step === currentStep);
    if (index < 0) {
      return {
        percent: 0,
        currentTitle: waitingReview ? "等待人工确认" : currentStep || "未开始"
      };
    }
    const total = steps.length;
    const ratio = total > 0 ? (index + 1) / total : 0;
    const basePercent = Math.round(ratio * 100);
    if (waitingReview) {
      return {
        percent: Math.min(basePercent, 95),
        currentTitle: "等待人工确认"
      };
    }
    if (currentStep === "WAYFAIR_POLL" && status !== "COMPLETED") {
      return {
        percent: Math.min(basePercent, 95),
        currentTitle: "轮询中"
      };
    }
    return { percent: basePercent, currentTitle: steps[index].title };
  }, [currentStep, status, steps]);

  useEffect(() => {
    const source = new EventSource(`${apiBase}/api/runs/${runId}/events`);
    source.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as {
          step?: string;
          data?: { status?: string; currentStep?: string };
        };
        if (parsed.data?.status) {
          setStatus(parsed.data.status);
        }
        if (parsed.data?.currentStep) {
          setCurrentStep(parsed.data.currentStep);
        }
        if (parsed.step) {
          setCurrentStep(parsed.step);
        }
      } catch {
        // Ignore malformed events
      }
    };
    source.onerror = () => {
      source.close();
    };
    return () => source.close();
  }, [runId]);

  return (
    <div className="card stack">
      <div className="row">
        <strong>Run 运行进度</strong>
        <span className="badge">状态: {status}</span>
        <span className="muted">当前步骤: {currentTitle}</span>
        <span className="muted">{percent}%</span>
      </div>
      <div className="progress-track" aria-hidden="true">
        <div className="progress-fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
