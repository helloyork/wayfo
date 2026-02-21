"use client";

import { useCallback, useEffect, useState } from "react";
import { apiBase } from "../../lib/api";

type RunJob = {
  id: string;
  step: string;
  status: string;
  attempts: number;
};

type RunJobsPanelProps = {
  runId: string;
  initialJobs: RunJob[];
};

export function RunJobsPanel({ runId, initialJobs }: RunJobsPanelProps) {
  const [jobs, setJobs] = useState<RunJob[]>(initialJobs);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/runs/${runId}`, { cache: "no-store" });
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
    <div className="card stack">
      <div className="row">
        <strong>Jobs</strong>
        <button className="btn" type="button" onClick={refresh} disabled={loading}>
          刷新
        </button>
        {lastUpdated ? <span className="muted">更新于 {lastUpdated}</span> : null}
      </div>
      {jobs.length === 0 ? (
        <div className="empty">暂无 Job</div>
      ) : (
        <div className="list">
          {jobs.map((job) => (
            <div key={job.id} className="list-item">
              <div className="row">
                <span className="badge">{job.status}</span>
                <span>{job.step}</span>
              </div>
              <div className="muted">重试次数: {job.attempts}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
