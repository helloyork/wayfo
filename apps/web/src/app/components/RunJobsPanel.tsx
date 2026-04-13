"use client";

import { useCallback, useEffect, useState } from "react";
import { apiBase } from "../../lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type RunJob = {
  id: string;
  step: string;
  status: string;
  attempts: number;
};

type RunJobsPanelProps = {
  runId: string;
  initialJobs: RunJob[];
  id?: string;
  className?: string;
};

export function RunJobsPanel({ runId, initialJobs, id, className }: RunJobsPanelProps) {
  const [jobs, setJobs] = useState<RunJob[]>(initialJobs);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/runs/${runId}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        return;
      }
      const payload = (await res.json()) as { jobs?: RunJob[] };
      setJobs(payload.jobs ?? []);
      setLastUpdated(new Date().toLocaleTimeString());
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    setLastUpdated(new Date().toLocaleTimeString());
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void refresh();
    }, 5000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  return (
    <Card
      id={id}
      className={cn("scroll-mt-24 shadow-sm", className)}
    >
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Jobs</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={loading}
            >
              刷新
            </Button>
            {lastUpdated ? (
              <span className="text-sm text-muted-foreground">
                更新于 {lastUpdated}
              </span>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {jobs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/50 px-4 py-8 text-center text-sm text-muted-foreground">
            暂无 Job
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="flex flex-col gap-1 rounded-lg border border-border bg-muted/30 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{job.status}</Badge>
                  <span className="font-medium">{job.step}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  重试次数: {job.attempts}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
