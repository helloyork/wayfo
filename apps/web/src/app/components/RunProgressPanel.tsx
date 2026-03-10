"use client";

import { useEffect, useMemo, useState } from "react";
import { apiBase } from "../../lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

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

export function RunProgressPanel({
  runId,
  steps,
  initialStatus,
  initialStep,
}: RunProgressPanelProps) {
  const [status, setStatus] = useState(initialStatus);
  const [currentStep, setCurrentStep] = useState(initialStep ?? "");

  const { percent, currentTitle } = useMemo(() => {
    if (status === "COMPLETED") {
      return { percent: 100, currentTitle: "完成" };
    }
    const waitingReview =
      status === "NEEDS_REVIEW" || status === "WAITING_FOR_REVIEW";
    const index = steps.findIndex((step) => step.step === currentStep);
    if (index < 0) {
      return {
        percent: 0,
        currentTitle: waitingReview ? "等待人工确认" : currentStep || "未开始",
      };
    }
    const total = steps.length;
    const ratio = total > 0 ? (index + 1) / total : 0;
    const basePercent = Math.round(ratio * 100);
    if (waitingReview) {
      return {
        percent: Math.min(basePercent, 95),
        currentTitle: "等待人工确认",
      };
    }
    if (currentStep === "WAYFAIR_POLL" && status !== "COMPLETED") {
      return {
        percent: Math.min(basePercent, 95),
        currentTitle: "轮询中",
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
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>Run 运行进度</CardTitle>
          <Badge variant="secondary">状态: {status}</Badge>
          <span className="text-sm text-muted-foreground">
            当前步骤: {currentTitle}
          </span>
          <span className="text-sm text-muted-foreground">{percent}%</span>
        </div>
      </CardHeader>
      <CardContent>
        <Progress value={percent} className="h-2" />
      </CardContent>
    </Card>
  );
}
