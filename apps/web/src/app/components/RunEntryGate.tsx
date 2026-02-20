"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiBase } from "../../lib/api";
import { CreateRunForm } from "./CreateRunForm";

type InitStatus = {
  ready: boolean;
  prerequisites: { wayfair: boolean };
  activeEnv: "sandbox" | "prod" | null;
  marketContextValid: boolean;
  taxonomy: {
    state: "READY" | "STALE" | "REFRESHING" | "BUILDING" | "MISSING";
    expiresAt: string | null;
    lastRefreshError: string | null;
  };
  task: null | {
    key: string;
    status: "IDLE" | "RUNNING" | "SUCCEEDED" | "FAILED";
    phase?: string;
    message?: string;
    page?: number;
    totalPages?: number;
    startedAt?: string;
    updatedAt?: string;
    error?: string;
  };
};

const storageKey = "wayfo.marketContext";
const sampleMarketContext = JSON.stringify(
  { locale: "en-US", country: "UNITED_STATES", brand: "WAYFAIR" },
  null,
  0
);

function percent(page?: number, total?: number) {
  if (!page || !total || total <= 0) {
    return null;
  }
  const value = Math.min(100, Math.max(0, Math.round((page / total) * 100)));
  return value;
}

export function RunEntryGate() {
  const [marketContext, setMarketContext] = useState("");
  const [status, setStatus] = useState<InitStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const pollRef = useRef<number | null>(null);

  const marketContextForQuery = useMemo(() => marketContext.trim(), [marketContext]);

  const load = async () => {
    const qs = new URLSearchParams();
    if (marketContextForQuery) {
      qs.set("marketContext", marketContextForQuery);
    }
    const res = await fetch(`${apiBase}/api/init/status?${qs.toString()}`, {
      cache: "no-store"
    });
    if (!res.ok) {
      return;
    }
    const payload = (await res.json()) as InitStatus;
    setStatus(payload);
  };

  useEffect(() => {
    const stored =
      typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null;
    setMarketContext(stored?.trim() ? stored : sampleMarketContext);
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketContextForQuery]);

  useEffect(() => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
    const interval =
      status?.task?.status === "RUNNING" || status?.taxonomy?.state === "BUILDING" ? 1000 : 5000;
    pollRef.current = window.setInterval(() => {
      load();
    }, interval);
    return () => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.task?.status, status?.taxonomy?.state, marketContextForQuery]);

  const onStartInit = async () => {
    if (!marketContext.trim()) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/init/taxonomy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketContext })
      });
      if (!res.ok) {
        const payload = (await res.json()) as { message?: string };
        throw new Error(payload.message ?? "初始化启动失败");
      }
      await load();
    } finally {
      setLoading(false);
    }
  };

  const onMarketContextChange = (next: string) => {
    setMarketContext(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, next);
    }
  };

  if (!status || !status.ready) {
    const pct = percent(status?.task?.page, status?.task?.totalPages);
    return (
      <div className="card stack">
        <div className="row">
          <strong>初始化</strong>
          <span className="muted">首次使用需要先初始化 taxonomy</span>
        </div>

        <div className="muted">
          前置条件：
          {" "}
          <span>
            Wayfair 凭据 {status?.prerequisites.wayfair ? "✅" : "❌"}
          </span>
          {status?.activeEnv ? <span>{" · "}当前环境 {status.activeEnv}</span> : null}
          {" · "}
          <Link className="muted" href="/settings">
            去设置页
          </Link>
        </div>

        <label className="stack">
          <span className="muted">Market Context</span>
          <textarea
            className="input"
            style={{ minHeight: 86, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
            value={marketContext}
            onChange={(e) => onMarketContextChange(e.target.value)}
            placeholder={sampleMarketContext}
          />
          {!status?.marketContextValid ? (
            <span className="muted">
              格式示例：{sampleMarketContext}
            </span>
          ) : null}
        </label>

        <div className="row">
          <button
            className="btn"
            type="button"
            onClick={onStartInit}
            disabled={
              loading ||
              !status?.prerequisites.wayfair ||
              !status?.marketContextValid ||
              status?.task?.status === "RUNNING"
            }
          >
            {status?.task?.status === "RUNNING" ? "初始化进行中..." : "开始初始化"}
          </button>
          <span className="muted">
            状态：{status?.taxonomy.state ?? "MISSING"}
            {status?.taxonomy.expiresAt ? `（过期时间 ${status.taxonomy.expiresAt}）` : ""}
          </span>
        </div>

        {status?.task ? (
          <div className="stack" style={{ gap: 10 }}>
            <div className="row">
              <span className="muted">
                {status.task.phase ?? "INIT"}：{status.task.message ?? ""}
              </span>
              {pct !== null ? <span className="muted">{pct}%</span> : null}
            </div>
            {status.task.status === "FAILED" ? (
              <span className="badge badge-danger">
                {status.task.error ?? "初始化失败"}
              </span>
            ) : status.task.status === "SUCCEEDED" ? (
              <span className="badge badge-success">初始化完成</span>
            ) : (
              <span className="badge badge-warning">初始化中</span>
            )}
          </div>
        ) : null}

        {status?.taxonomy.lastRefreshError ? (
          <span className="badge badge-warning">{status.taxonomy.lastRefreshError}</span>
        ) : null}
      </div>
    );
  }

  return <CreateRunForm initialMarketContext={marketContext} onMarketContextChange={onMarketContextChange} />;
}

